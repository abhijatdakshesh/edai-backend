import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { NaacReportEntity } from './entities/naac-report.entity';
import { NaacCriterionCalculatorService } from './naac-criterion-calculator.service';

export const NAAC_REPORT_QUEUE = 'naac-report';

export interface NaacReportJob {
  reportId: string;
  academicYear: string;
  /** Stubbed data for now; wired to academic-svc via HTTP in Phase 3 */
  criterionInputs?: Record<string, unknown>;
}

@Processor(NAAC_REPORT_QUEUE)
export class NaacReportProcessor extends WorkerHost {
  private readonly logger = new Logger(NaacReportProcessor.name);

  constructor(
    @InjectRepository(NaacReportEntity)
    private readonly reportRepo: Repository<NaacReportEntity>,
    private readonly calculator: NaacCriterionCalculatorService,
  ) {
    super();
  }

  async process(job: Job<NaacReportJob>): Promise<void> {
    const { reportId } = job.data;
    this.logger.log(`Processing NAAC report job=${reportId}`);

    await this.reportRepo.update(reportId, { status: 'PROCESSING' });

    try {
      // Phase 1: compute with placeholder data (wired to live data in Phase 3)
      const c2 = this.calculator.computeCriterion2({
        totalStudents: 2000,
        totalFaculty: 140,
        averageAttendancePct: 78,
        facultyWithPhDPct: 42,
        syllabusCoveragePct: 85,
        passPercentage: 82,
      });

      const c3 = this.calculator.computeCriterion3({
        peerReviewedPublications: 220,
        fundedProjects: 8,
        totalFaculty: 140,
        patentsFiled: 3,
        researchFundingLakhs: 18,
      });

      // Phase 3: generate actual PDF/DOCX and upload to S3/MinIO
      const s3Key = `naac-reports/${reportId}.json`;

      await this.reportRepo.update(reportId, {
        status: 'DONE',
        criterionScores: {
          criterion2: { score: c2.totalScore, max: c2.maxScore, pct: c2.pct },
          criterion3: { score: c3.totalScore, max: c3.maxScore, pct: c3.pct },
        } as unknown as null,
        s3Key,
      });

      this.logger.log(`NAAC report done job=${reportId} c2=${c2.pct}% c3=${c3.pct}%`);
    } catch (err) {
      this.logger.error(`NAAC report failed job=${reportId}`, err);
      await this.reportRepo.update(reportId, {
        status: 'FAILED',
        errorDetail: String(err),
      });
      throw err;
    }
  }
}
