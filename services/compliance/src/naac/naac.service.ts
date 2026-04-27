import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import { NaacCriterionSnapshotEntity } from './entities/naac-criterion-snapshot.entity';
import { NaacReportEntity, type ReportFormat } from './entities/naac-report.entity';
import { NaacCriterionCalculatorService, type Criterion2Input, type Criterion3Input } from './naac-criterion-calculator.service';
import { NAAC_REPORT_QUEUE, type NaacReportJob } from './naac-report.processor';

export interface GenerateReportDto {
  academicYear: string;
  generatedBy: string;
  format: ReportFormat;
}

export interface ComputeCriterionDto {
  academicYear: string;
  dataPeriodEnd: string;
  input: Criterion2Input | Criterion3Input;
}

@Injectable()
export class NaacService {
  private readonly logger = new Logger(NaacService.name);

  constructor(
    @InjectRepository(NaacReportEntity)
    private readonly reportRepo: Repository<NaacReportEntity>,
    @InjectRepository(NaacCriterionSnapshotEntity)
    private readonly snapshotRepo: Repository<NaacCriterionSnapshotEntity>,
    @InjectQueue(NAAC_REPORT_QUEUE)
    private readonly queue: Queue<NaacReportJob>,
    private readonly calculator: NaacCriterionCalculatorService,
  ) {}

  async generateReport(dto: GenerateReportDto): Promise<NaacReportEntity> {
    const report = this.reportRepo.create({
      academicYear: dto.academicYear,
      generatedBy: dto.generatedBy,
      format: dto.format,
      status: 'PENDING',
    });
    const saved = await this.reportRepo.save(report);

    await this.queue.add('generate', {
      reportId: saved.id,
      academicYear: dto.academicYear,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

    this.logger.log(`NaacReport queued reportId=${saved.id} year=${dto.academicYear}`);
    return saved;
  }

  async getReport(reportId: string): Promise<NaacReportEntity> {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException(`Report ${reportId} not found`);
    return report;
  }

  async listReports(academicYear?: string): Promise<NaacReportEntity[]> {
    const qb = this.reportRepo.createQueryBuilder('r').orderBy('r.triggeredAt', 'DESC');
    if (academicYear) qb.where('r.academicYear = :academicYear', { academicYear });
    return qb.getMany();
  }

  async computeAndSaveCriterion2(dto: ComputeCriterionDto & { input: Criterion2Input }): Promise<NaacCriterionSnapshotEntity> {
    const result = this.calculator.computeCriterion2(dto.input);
    return this.saveSnapshot(2, dto.academicYear, dto.dataPeriodEnd, result.totalScore, result.maxScore, dto.input as unknown as Record<string, unknown>);
  }

  async computeAndSaveCriterion3(dto: ComputeCriterionDto & { input: Criterion3Input }): Promise<NaacCriterionSnapshotEntity> {
    const result = this.calculator.computeCriterion3(dto.input);
    return this.saveSnapshot(3, dto.academicYear, dto.dataPeriodEnd, result.totalScore, result.maxScore, dto.input as unknown as Record<string, unknown>);
  }

  async getDashboard(academicYear: string): Promise<{
    academicYear: string;
    criteria: { criterion: number; score: number | null; maxScore: number | null; pct: number | null; lastUpdated: Date }[];
  }> {
    const snapshots = await this.snapshotRepo
      .createQueryBuilder('s')
      .where('s.academicYear = :academicYear', { academicYear })
      .andWhere('s.subCriterion IS NULL')
      .orderBy('s.computedAt', 'DESC')
      .getMany();

    const latestByCriterion = new Map<number, NaacCriterionSnapshotEntity>();
    for (const snap of snapshots) {
      if (!latestByCriterion.has(snap.criterion)) latestByCriterion.set(snap.criterion, snap);
    }

    const criteria = [2, 3].map((c) => {
      const snap = latestByCriterion.get(c);
      return {
        criterion: c,
        score: snap ? Number(snap.score) : null,
        maxScore: snap ? Number(snap.maxScore) : null,
        pct: snap && snap.score && snap.maxScore ? Math.round((Number(snap.score) / Number(snap.maxScore)) * 10000) / 100 : null,
        lastUpdated: snap?.computedAt ?? new Date(0),
      };
    });

    return { academicYear, criteria };
  }

  private async saveSnapshot(
    criterion: number,
    academicYear: string,
    dataPeriodEnd: string,
    score: number,
    maxScore: number,
    dataPayload: Record<string, unknown>,
  ): Promise<NaacCriterionSnapshotEntity> {
    const existing = await this.snapshotRepo.findOne({
      where: { academicYear, criterion: criterion as 1, subCriterion: IsNull(), dataPeriodEnd },
    });

    if (existing) {
      existing.score = score;
      existing.maxScore = maxScore;
      existing.dataPayload = dataPayload;
      return this.snapshotRepo.save(existing);
    }

    const snapshot = this.snapshotRepo.create({
      academicYear,
      criterion: criterion as 1,
      subCriterion: null,
      score,
      maxScore,
      dataPayload,
      dataPeriodEnd,
    });
    return this.snapshotRepo.save(snapshot);
  }
}
