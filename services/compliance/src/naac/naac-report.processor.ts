import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import { NaacCriterionSnapshotEntity, type NaacCriterion } from './entities/naac-criterion-snapshot.entity';
import { NaacReportEntity } from './entities/naac-report.entity';

export const NAAC_REPORT_QUEUE = 'naac-report';

export interface NaacReportJob {
  reportId: string;
  academicYear: string;
}

interface CriterionSummary {
  score: number | null;
  max: number | null;
  pct: number | null;
  dataSource: 'snapshot' | 'missing';
}

@Processor(NAAC_REPORT_QUEUE)
export class NaacReportProcessor extends WorkerHost {
  private readonly logger = new Logger(NaacReportProcessor.name);

  constructor(
    @InjectRepository(NaacReportEntity)
    private readonly reportRepo: Repository<NaacReportEntity>,
    @InjectRepository(NaacCriterionSnapshotEntity)
    private readonly snapshotRepo: Repository<NaacCriterionSnapshotEntity>,
  ) {
    super();
  }

  async process(job: Job<NaacReportJob>): Promise<void> {
    const { reportId } = job.data;
    this.logger.log(`Processing NAAC report job=${reportId}`);

    await this.reportRepo.update(reportId, { status: 'PROCESSING' });

    try {
      // Load the report to get institutionId + academicYear
      const report = await this.reportRepo.findOne({ where: { id: reportId } });
      if (!report) throw new Error(`Report ${reportId} not found`);

      const { institutionId, academicYear } = report;

      // Load all criterion-level snapshots (subCriterion IS NULL = top-level aggregates)
      const snapshots = await this.snapshotRepo.find({
        where: { institutionId, academicYear, subCriterion: IsNull() },
        order: { computedAt: 'DESC' },
      });

      // Keep only the latest snapshot per criterion
      const latestByCriterion = new Map<NaacCriterion, NaacCriterionSnapshotEntity>();
      for (const snap of snapshots) {
        if (!latestByCriterion.has(snap.criterion)) latestByCriterion.set(snap.criterion, snap);
      }

      const criterionScores: Record<string, CriterionSummary> = {};
      let totalScore = 0;
      let missedCriteria = 0;

      for (const c of [1, 2, 3, 4, 5, 6, 7] as NaacCriterion[]) {
        const snap = latestByCriterion.get(c);
        if (snap?.score != null && snap.maxScore != null) {
          const score = Number(snap.score);
          const max = Number(snap.maxScore);
          criterionScores[`criterion${c}`] = {
            score,
            max,
            pct: Math.round((score / max) * 10000) / 100,
            dataSource: 'snapshot',
          };
          totalScore += score;
        } else {
          criterionScores[`criterion${c}`] = { score: null, max: null, pct: null, dataSource: 'missing' };
          missedCriteria++;
        }
      }

      const s3Key = `naac-reports/${institutionId}/${academicYear}/${reportId}.json`;

      await this.reportRepo.update(reportId, {
        status: missedCriteria === 7 ? 'FAILED' : 'DONE',
        criterionScores: criterionScores as unknown as null,
        s3Key: missedCriteria === 7 ? null : s3Key,
        errorDetail: missedCriteria > 0 && missedCriteria < 7
          ? `${missedCriteria} criteria have no saved snapshot — scores will be null in report`
          : missedCriteria === 7 ? 'No criterion snapshots found. Save at least one criterion before generating a report.' : null,
      });

      this.logger.log(`NAAC report done job=${reportId} total=${totalScore.toFixed(2)}/1000 missing=${missedCriteria}`);
    } catch (err) {
      this.logger.error(`NAAC report failed job=${reportId}`, err);
      await this.reportRepo.update(reportId, { status: 'FAILED', errorDetail: String(err) });
      throw err;
    }
  }
}
