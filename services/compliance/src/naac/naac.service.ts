import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import { NaacCriterionSnapshotEntity, type NaacCriterion } from './entities/naac-criterion-snapshot.entity';
import { NaacReportEntity, type ReportFormat } from './entities/naac-report.entity';
import {
  NaacCriterionCalculatorService,
  CRITERION_MAX_SCORES,
  type Criterion1Input,
  type Criterion2Input,
  type Criterion3Input,
  type Criterion4Input,
  type Criterion5Input,
  type Criterion6Input,
  type Criterion7Input,
} from './naac-criterion-calculator.service';
import { NAAC_REPORT_QUEUE, type NaacReportJob } from './naac-report.processor';

export interface GenerateReportDto {
  institutionId: string;
  academicYear: string;
  generatedBy: string;
  format: ReportFormat;
}

export interface ComputeCriterionDto {
  institutionId: string;
  academicYear: string;
  dataPeriodEnd: string;
  input: Criterion1Input | Criterion2Input | Criterion3Input | Criterion4Input | Criterion5Input | Criterion6Input | Criterion7Input;
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
      institutionId: dto.institutionId,
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

  async computeAndSaveCriterion1(dto: ComputeCriterionDto & { input: Criterion1Input }): Promise<NaacCriterionSnapshotEntity> {
    const result = this.calculator.computeCriterion1(dto.input);
    return this.saveSnapshot(dto.institutionId, 1, dto.academicYear, dto.dataPeriodEnd, result.totalScore, result.maxScore, dto.input as unknown as Record<string, unknown>);
  }

  async computeAndSaveCriterion2(dto: ComputeCriterionDto & { input: Criterion2Input }): Promise<NaacCriterionSnapshotEntity> {
    const result = this.calculator.computeCriterion2(dto.input);
    return this.saveSnapshot(dto.institutionId, 2, dto.academicYear, dto.dataPeriodEnd, result.totalScore, result.maxScore, dto.input as unknown as Record<string, unknown>);
  }

  async computeAndSaveCriterion3(dto: ComputeCriterionDto & { input: Criterion3Input }): Promise<NaacCriterionSnapshotEntity> {
    const result = this.calculator.computeCriterion3(dto.input);
    return this.saveSnapshot(dto.institutionId, 3, dto.academicYear, dto.dataPeriodEnd, result.totalScore, result.maxScore, dto.input as unknown as Record<string, unknown>);
  }

  async computeAndSaveCriterion4(dto: ComputeCriterionDto & { input: Criterion4Input }): Promise<NaacCriterionSnapshotEntity> {
    const result = this.calculator.computeCriterion4(dto.input);
    return this.saveSnapshot(dto.institutionId, 4, dto.academicYear, dto.dataPeriodEnd, result.totalScore, result.maxScore, dto.input as unknown as Record<string, unknown>);
  }

  async computeAndSaveCriterion5(dto: ComputeCriterionDto & { input: Criterion5Input }): Promise<NaacCriterionSnapshotEntity> {
    const result = this.calculator.computeCriterion5(dto.input);
    return this.saveSnapshot(dto.institutionId, 5, dto.academicYear, dto.dataPeriodEnd, result.totalScore, result.maxScore, dto.input as unknown as Record<string, unknown>);
  }

  async computeAndSaveCriterion6(dto: ComputeCriterionDto & { input: Criterion6Input }): Promise<NaacCriterionSnapshotEntity> {
    const result = this.calculator.computeCriterion6(dto.input);
    return this.saveSnapshot(dto.institutionId, 6, dto.academicYear, dto.dataPeriodEnd, result.totalScore, result.maxScore, dto.input as unknown as Record<string, unknown>);
  }

  async computeAndSaveCriterion7(dto: ComputeCriterionDto & { input: Criterion7Input }): Promise<NaacCriterionSnapshotEntity> {
    const result = this.calculator.computeCriterion7(dto.input);
    return this.saveSnapshot(dto.institutionId, 7, dto.academicYear, dto.dataPeriodEnd, result.totalScore, result.maxScore, dto.input as unknown as Record<string, unknown>);
  }

  async getDashboard(institutionId: string, academicYear: string): Promise<{
    academicYear: string;
    criteria: { criterion: number; score: number | null; maxScore: number | null; pct: number | null; lastUpdated: Date }[];
  }> {
    const snapshots = await this.snapshotRepo
      .createQueryBuilder('s')
      .where('s.institutionId = :institutionId', { institutionId })
      .andWhere('s.academicYear = :academicYear', { academicYear })
      .andWhere('s.subCriterion IS NULL')
      .orderBy('s.computedAt', 'DESC')
      .getMany();

    const latestByCriterion = new Map<number, NaacCriterionSnapshotEntity>();
    for (const snap of snapshots) {
      if (!latestByCriterion.has(snap.criterion)) latestByCriterion.set(snap.criterion, snap);
    }

    const criteria = [1, 2, 3, 4, 5, 6, 7].map((c) => {
      const snap = latestByCriterion.get(c);
      return {
        criterion: c,
        score: snap ? Number(snap.score) : null,
        maxScore: snap?.maxScore != null ? Number(snap.maxScore) : CRITERION_MAX_SCORES[c] ?? null,
        pct: snap && snap.score && snap.maxScore ? Math.round((Number(snap.score) / Number(snap.maxScore)) * 10000) / 100 : null,
        lastUpdated: snap?.computedAt ?? new Date(0),
      };
    });

    return { academicYear, criteria };
  }

  private async saveSnapshot(
    institutionId: string,
    criterion: NaacCriterion,
    academicYear: string,
    dataPeriodEnd: string,
    score: number,
    maxScore: number,
    dataPayload: Record<string, unknown>,
  ): Promise<NaacCriterionSnapshotEntity> {
    const existing = await this.snapshotRepo.findOne({
      where: { institutionId, academicYear, criterion, subCriterion: IsNull(), dataPeriodEnd },
    });

    if (existing) {
      existing.score = score;
      existing.maxScore = maxScore;
      existing.dataPayload = dataPayload;
      return this.snapshotRepo.save(existing);
    }

    const snapshot = this.snapshotRepo.create({
      institutionId,
      academicYear,
      criterion,
      subCriterion: null,
      score,
      maxScore,
      dataPayload,
      dataPeriodEnd,
    });
    return this.snapshotRepo.save(snapshot);
  }
}
