import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertEventEntity } from './entities/alert-event.entity';
import { AlertRuleEntity } from './entities/alert-rule.entity';
import { RiskSnapshotEntity } from './entities/risk-snapshot.entity';
import { ScoringWeightEntity, DEFAULT_WEIGHTS, type RiskFactor } from './entities/scoring-weight.entity';
import { EwsRiskEngineService, type RiskInput } from './ews-risk-engine.service';
import { KafkaProducerService } from './kafka-producer.service';

export interface ScoreStudentDto extends RiskInput {
  studentId: string;
  academicYear: string;
  semester: number;
}

export interface AcknowledgeAlertDto {
  acknowledgedBy: string;
  note?: string;
}

@Injectable()
export class EarlyWarningService {
  private readonly logger = new Logger(EarlyWarningService.name);

  constructor(
    @InjectRepository(RiskSnapshotEntity)
    private readonly snapshotRepo: Repository<RiskSnapshotEntity>,
    @InjectRepository(AlertRuleEntity)
    private readonly ruleRepo: Repository<AlertRuleEntity>,
    @InjectRepository(AlertEventEntity)
    private readonly alertRepo: Repository<AlertEventEntity>,
    @InjectRepository(ScoringWeightEntity)
    private readonly weightRepo: Repository<ScoringWeightEntity>,
    private readonly riskEngine: EwsRiskEngineService,
    private readonly kafka: KafkaProducerService,
  ) {}

  async scoreStudent(dto: ScoreStudentDto): Promise<RiskSnapshotEntity> {
    const weights = await this.loadWeights();
    const result = this.riskEngine.compute(dto, weights);

    const snapshot = this.snapshotRepo.create({
      studentId: dto.studentId,
      academicYear: dto.academicYear,
      semester: dto.semester,
      attendancePct: dto.attendancePct,
      marksAvg: dto.marksAvg,
      assignmentsSubmitted: dto.assignmentsSubmitted,
      assignmentsTotal: dto.assignmentsTotal,
      feesOverdueDays: dto.feesOverdueDays,
      examRegistered: dto.examRegistered,
      riskScore: result.score,
      riskLevel: result.level,
      factors: result.factors,
    });

    const saved = await this.snapshotRepo.save(snapshot);
    this.logger.log(
      `RiskScored studentId=${dto.studentId} score=${result.score} level=${result.level}`,
    );

    await this.kafka.emitRiskScored({
      studentId: dto.studentId,
      academicYear: dto.academicYear,
      semester: dto.semester,
      score: result.score,
      level: result.level,
      factors: result.factors,
      snapshotId: saved.id,
      ts: new Date().toISOString(),
    });

    await this.dispatchAlerts(saved);
    return saved;
  }

  async getLatestRisk(studentId: string): Promise<RiskSnapshotEntity | null> {
    return this.snapshotRepo.findOne({
      where: { studentId },
      order: { snapshotAt: 'DESC' },
    });
  }

  async getRiskHistory(studentId: string, days = 90): Promise<RiskSnapshotEntity[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.snapshotRepo
      .createQueryBuilder('s')
      .where('s.studentId = :studentId', { studentId })
      .andWhere('s.snapshotAt >= :since', { since })
      .orderBy('s.snapshotAt', 'ASC')
      .getMany();
  }

  async getActiveAlerts(studentId?: string): Promise<AlertEventEntity[]> {
    const qb = this.alertRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.rule', 'rule')
      .where('a.acknowledgedBy IS NULL')
      .orderBy('a.triggeredAt', 'DESC');
    if (studentId) qb.andWhere('a.studentId = :studentId', { studentId });
    return qb.getMany();
  }

  async acknowledgeAlert(alertId: string, dto: AcknowledgeAlertDto): Promise<AlertEventEntity> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException(`Alert ${alertId} not found`);
    alert.acknowledgedBy = dto.acknowledgedBy;
    alert.acknowledgedAt = new Date();
    alert.note = dto.note ?? null;
    return this.alertRepo.save(alert);
  }

  async getWeights(): Promise<ScoringWeightEntity[]> {
    return this.weightRepo.find({ where: { active: true } });
  }

  async updateWeights(updates: { factor: RiskFactor; weight: number }[]): Promise<ScoringWeightEntity[]> {
    for (const u of updates) {
      if (typeof u.weight !== 'number' || !isFinite(u.weight)) {
        throw new Error(`Invalid weight for factor ${u.factor}: must be a finite number`);
      }
    }
    const total = updates.reduce((s, u) => s + u.weight, 0);
    if (Math.abs(total - 1) > 0.001) {
      throw new Error(`Weights must sum to 1.0 (got ${total.toFixed(3)})`);
    }
    return this.weightRepo.manager.transaction(async (em) => {
      const results: ScoringWeightEntity[] = [];
      for (const u of updates) {
        let entity = await em.findOne(ScoringWeightEntity, { where: { factor: u.factor } });
        if (!entity) {
          entity = em.create(ScoringWeightEntity, { factor: u.factor, weight: u.weight, active: true });
        } else {
          entity.weight = u.weight;
        }
        results.push(await em.save(ScoringWeightEntity, entity));
      }
      return results;
    });
  }

  private async loadWeights(): Promise<Record<RiskFactor, number>> {
    const rows = await this.weightRepo.find({ where: { active: true } });
    if (rows.length === 0) return DEFAULT_WEIGHTS;
    return Object.fromEntries(rows.map((r) => [r.factor, Number(r.weight)])) as Record<RiskFactor, number>;
  }

  private async dispatchAlerts(snapshot: RiskSnapshotEntity): Promise<void> {
    const rules = await this.ruleRepo.find({ where: { active: true } });
    for (const rule of rules) {
      if (snapshot.riskScore < rule.threshold) continue;

      const cooldownDate = new Date();
      cooldownDate.setHours(cooldownDate.getHours() - rule.cooldownHours);

      const recent = await this.alertRepo
        .createQueryBuilder('a')
        .where('a.studentId = :studentId', { studentId: snapshot.studentId })
        .andWhere('a.rule = :ruleId', { ruleId: rule.id })
        .andWhere('a.triggeredAt >= :since', { since: cooldownDate })
        .getCount();

      if (recent > 0) continue;

      const event = this.alertRepo.create({
        studentId: snapshot.studentId,
        rule,
        snapshotId: snapshot.id,
        notifiedRoles: rule.notifyRoles,
      });
      const saved = await this.alertRepo.save(event);

      this.logger.warn(
        `AlertTriggered studentId=${snapshot.studentId} rule=${rule.name} level=${snapshot.riskLevel}`,
      );

      await this.kafka.emitAlertTriggered({
        studentId: snapshot.studentId,
        snapshotId: snapshot.id,
        level: snapshot.riskLevel,
        ruleId: rule.id,
        notifyRoles: rule.notifyRoles,
        ts: saved.triggeredAt.toISOString(),
      });
    }
  }
}
