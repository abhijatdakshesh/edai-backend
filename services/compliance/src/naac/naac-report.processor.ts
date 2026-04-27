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
      const c1 = this.calculator.computeCriterion1({
        boardStudyProgrammesPct: 80,
        electiveCreditsPct: 25,
        valueAddedCoursesCount: 8,
        feedbackSystemScore: 72,
      });
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
      const c4 = this.calculator.computeCriterion4({
        classroomsWithICTPct: 85,
        libraryResourcesCount: 45000,
        internetBandwidthMbps: 400,
        totalStudents: 2000,
        maintenanceBudgetPct: 4,
      });
      const c5 = this.calculator.computeCriterion5({
        scholarshipStudentsPct: 35,
        placementPct: 72,
        higherStudiesPct: 15,
        studentAchievementsCount: 12,
        alumniContributionsLakhs: 8,
      });
      const c6 = this.calculator.computeCriterion6({
        strategicPlanScore: 75,
        iqacFunctionalityScore: 80,
        facultyAwardCount: 6,
        eGovernancePct: 65,
        auditCompliancePct: 88,
      });
      const c7 = this.calculator.computeCriterion7({
        greenInitiativesCount: 6,
        genderEquityProgramsCount: 4,
        bestPracticesCount: 2,
        distinctivenessScore: 70,
      });

      // Phase 3: generate actual PDF/DOCX and upload to S3/MinIO
      const s3Key = `naac-reports/${reportId}.json`;

      await this.reportRepo.update(reportId, {
        status: 'DONE',
        criterionScores: {
          criterion1: { score: c1.totalScore, max: c1.maxScore, pct: c1.pct },
          criterion2: { score: c2.totalScore, max: c2.maxScore, pct: c2.pct },
          criterion3: { score: c3.totalScore, max: c3.maxScore, pct: c3.pct },
          criterion4: { score: c4.totalScore, max: c4.maxScore, pct: c4.pct },
          criterion5: { score: c5.totalScore, max: c5.maxScore, pct: c5.pct },
          criterion6: { score: c6.totalScore, max: c6.maxScore, pct: c6.pct },
          criterion7: { score: c7.totalScore, max: c7.maxScore, pct: c7.pct },
        } as unknown as null,
        s3Key,
      });

      const totalScore = c1.totalScore + c2.totalScore + c3.totalScore + c4.totalScore + c5.totalScore + c6.totalScore + c7.totalScore;
      this.logger.log(`NAAC report done job=${reportId} total=${totalScore}/1000`);
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
