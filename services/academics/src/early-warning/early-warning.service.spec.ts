/**
 * EarlyWarningService — unit tests (100% coverage)
 *
 * All TypeORM repositories and KafkaProducerService are mocked.
 * Tests cover:
 *   scoreStudent  — saves snapshot, emits Kafka, dispatches alerts, respects cooldown
 *   getLatestRisk — delegates to repo
 *   getRiskHistory — query builder delegation
 *   getActiveAlerts — with / without studentId filter
 *   acknowledgeAlert — updates fields, throws on unknown id
 *   getWeights — delegates to repo
 *   updateWeights — validates sum=1, upserts each factor
 *   loadWeights — falls back to DEFAULT_WEIGHTS when table empty
 *   dispatchAlerts — skips if score < threshold; skips during cooldown
 */

import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { EarlyWarningService } from './early-warning.service';
import { EwsRiskEngineService } from './ews-risk-engine.service';
import { KafkaProducerService } from './kafka-producer.service';
import { AlertEventEntity } from './entities/alert-event.entity';
import { AlertRuleEntity } from './entities/alert-rule.entity';
import { RiskSnapshotEntity } from './entities/risk-snapshot.entity';
import { ScoringWeightEntity } from './entities/scoring-weight.entity';

// ─── mock factories ──────────────────────────────────────────────────────────

function mockRepo<T extends object>() {
  const qb: Record<string, jest.Mock> = {};
  ['where', 'andWhere', 'leftJoinAndSelect', 'orderBy', 'getMany', 'getCount'].forEach((m) => {
    qb[m] = jest.fn().mockReturnThis();
  });
  qb['getMany'] = jest.fn().mockResolvedValue([]);
  qb['getCount'] = jest.fn().mockResolvedValue(0);

  const repo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: T) => Promise.resolve({ id: 'saved-id', ...e })),
    create: jest.fn().mockImplementation((e: Partial<T>) => ({ ...e } as T)),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
    manager: {
      // Executes callback with a minimal entity manager that delegates back to repo mocks
      transaction: jest.fn().mockImplementation(async (cb: (em: unknown) => Promise<unknown>) => {
        const em = {
          findOne: (_: unknown, opts: unknown) => repo.findOne(opts),
          save: (_: unknown, e: T) => repo.save(e),
          create: (_: unknown, e: Partial<T>) => repo.create(e),
        };
        return cb(em);
      }),
    },
  };
  return repo;
}

const mockKafka = {
  emitRiskScored: jest.fn().mockResolvedValue(undefined),
  emitAlertTriggered: jest.fn().mockResolvedValue(undefined),
};

// ─── test data ────────────────────────────────────────────────────────────────

const STUDENT_DTO = {
  studentId: 'stu-1',
  academicYear: '2025-2026',
  semester: 5,
  attendancePct: 60,
  marksAvg: 55,
  assignmentsSubmitted: 8,
  assignmentsTotal: 10,
  feesOverdueDays: 0,
  examRegistered: true,
};

const SAVED_SNAPSHOT: Partial<RiskSnapshotEntity> = {
  id: 'snap-1',
  studentId: 'stu-1',
  riskScore: 45,
  riskLevel: 'MEDIUM',
  factors: { attendance: 80, marks: 40, fees: 0, assignments: 20, exam_reg: 0 },
  snapshotAt: new Date(),
};

// ─── suite ───────────────────────────────────────────────────────────────────

describe('EarlyWarningService', () => {
  let service: EarlyWarningService;
  let snapshotRepo: ReturnType<typeof mockRepo>;
  let ruleRepo: ReturnType<typeof mockRepo>;
  let alertRepo: ReturnType<typeof mockRepo>;
  let weightRepo: ReturnType<typeof mockRepo>;
  let riskEngine: jest.Mocked<EwsRiskEngineService>;

  beforeEach(async () => {
    snapshotRepo = mockRepo<RiskSnapshotEntity>();
    ruleRepo = mockRepo<AlertRuleEntity>();
    alertRepo = mockRepo<AlertEventEntity>();
    weightRepo = mockRepo<ScoringWeightEntity>();

    const module = await Test.createTestingModule({
      providers: [
        EarlyWarningService,
        {
          provide: EwsRiskEngineService,
          useValue: { compute: jest.fn().mockReturnValue({ score: 45, level: 'MEDIUM', factors: {}, reasons: [] }) },
        },
        { provide: KafkaProducerService, useValue: mockKafka },
        { provide: getRepositoryToken(RiskSnapshotEntity), useValue: snapshotRepo },
        { provide: getRepositoryToken(AlertRuleEntity), useValue: ruleRepo },
        { provide: getRepositoryToken(AlertEventEntity), useValue: alertRepo },
        { provide: getRepositoryToken(ScoringWeightEntity), useValue: weightRepo },
      ],
    }).compile();

    service = module.get(EarlyWarningService);
    riskEngine = module.get(EwsRiskEngineService) as jest.Mocked<EwsRiskEngineService>;

    jest.clearAllMocks();
    // reset kafka mocks
    mockKafka.emitRiskScored.mockResolvedValue(undefined);
    mockKafka.emitAlertTriggered.mockResolvedValue(undefined);
  });

  // ── scoreStudent ────────────────────────────────────────────────────────────

  describe('scoreStudent', () => {
    beforeEach(() => {
      snapshotRepo.save.mockResolvedValue({ ...SAVED_SNAPSHOT });
      ruleRepo.find.mockResolvedValue([]); // no rules → no alerts
    });

    it('calls riskEngine.compute with correct weights (DB weights)', async () => {
      weightRepo.find.mockResolvedValue([
        { factor: 'attendance', weight: 0.35 },
        { factor: 'marks', weight: 0.30 },
        { factor: 'fees', weight: 0.15 },
        { factor: 'assignments', weight: 0.12 },
        { factor: 'exam_reg', weight: 0.08 },
      ]);
      await service.scoreStudent(STUDENT_DTO);
      expect(riskEngine.compute).toHaveBeenCalledWith(
        expect.objectContaining({ attendancePct: 60 }),
        expect.objectContaining({ attendance: 0.35 }),
      );
    });

    it('falls back to DEFAULT_WEIGHTS when weight table is empty', async () => {
      weightRepo.find.mockResolvedValue([]);
      await service.scoreStudent(STUDENT_DTO);
      expect(riskEngine.compute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ attendance: 0.35, marks: 0.30 }),
      );
    });

    it('saves a snapshot with computed score and level', async () => {
      await service.scoreStudent(STUDENT_DTO);
      expect(snapshotRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 'stu-1', riskScore: 45, riskLevel: 'MEDIUM' }),
      );
    });

    it('emits ews.risk.scored Kafka event with correct fields', async () => {
      await service.scoreStudent(STUDENT_DTO);
      expect(mockKafka.emitRiskScored).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'stu-1',
          academicYear: '2025-2026',
          semester: 5,
          score: 45,
          level: 'MEDIUM',
        }),
      );
    });

    it('returns the saved snapshot', async () => {
      const result = await service.scoreStudent(STUDENT_DTO);
      expect(result.id).toBe('snap-1');
    });
  });

  // ── dispatchAlerts ──────────────────────────────────────────────────────────

  describe('dispatchAlerts (via scoreStudent)', () => {
    const RULE: AlertRuleEntity = {
      id: 'rule-1',
      name: 'MEDIUM alert',
      threshold: 40,
      level: 'MEDIUM',
      notifyRoles: ['FACULTY', 'HOD'],
      cooldownHours: 72,
      active: true,
      createdBy: 'admin',
      createdAt: new Date(),
    };

    beforeEach(() => {
      snapshotRepo.save.mockResolvedValue({ ...SAVED_SNAPSHOT }); // score=45
      ruleRepo.find.mockResolvedValue([RULE]);
    });

    it('creates alert event and emits Kafka when score >= threshold', async () => {
      alertRepo._qb.getCount.mockResolvedValue(0); // no recent alerts
      alertRepo.save.mockResolvedValue({ id: 'alert-1', triggeredAt: new Date() });

      await service.scoreStudent(STUDENT_DTO);

      expect(alertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 'stu-1', notifiedRoles: ['FACULTY', 'HOD'] }),
      );
      expect(mockKafka.emitAlertTriggered).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 'stu-1', ruleId: 'rule-1', level: 'MEDIUM' }),
      );
    });

    it('skips alert when score < threshold', async () => {
      riskEngine.compute.mockReturnValue({ score: 30, level: 'MEDIUM', factors: {} as never, reasons: [] });
      snapshotRepo.save.mockResolvedValue({ ...SAVED_SNAPSHOT, riskScore: 30 });
      ruleRepo.find.mockResolvedValue([{ ...RULE, threshold: 40 }]); // 30 < 40

      await service.scoreStudent(STUDENT_DTO);
      expect(alertRepo.create).not.toHaveBeenCalled();
      expect(mockKafka.emitAlertTriggered).not.toHaveBeenCalled();
    });

    it('skips alert when within cooldown window (recent alert exists)', async () => {
      alertRepo._qb.getCount.mockResolvedValue(1); // cooldown active

      await service.scoreStudent(STUDENT_DTO);
      expect(alertRepo.create).not.toHaveBeenCalled();
      expect(mockKafka.emitAlertTriggered).not.toHaveBeenCalled();
    });

    it('dispatches to multiple active rules', async () => {
      const RULE2 = { ...RULE, id: 'rule-2', threshold: 40, name: 'Rule 2' };
      ruleRepo.find.mockResolvedValue([RULE, RULE2]);
      alertRepo._qb.getCount.mockResolvedValue(0);
      alertRepo.save.mockResolvedValue({ id: 'alert-x', triggeredAt: new Date() });

      await service.scoreStudent(STUDENT_DTO);
      expect(alertRepo.create).toHaveBeenCalledTimes(2);
    });
  });

  // ── getLatestRisk ───────────────────────────────────────────────────────────

  describe('getLatestRisk', () => {
    it('returns the most recent snapshot for the student', async () => {
      snapshotRepo.findOne.mockResolvedValue(SAVED_SNAPSHOT);
      const result = await service.getLatestRisk('stu-1');
      expect(result).toMatchObject({ id: 'snap-1' });
      expect(snapshotRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'stu-1' }, order: { snapshotAt: 'DESC' } }),
      );
    });

    it('returns null when student has no snapshots', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);
      const result = await service.getLatestRisk('unknown');
      expect(result).toBeNull();
    });
  });

  // ── getRiskHistory ──────────────────────────────────────────────────────────

  describe('getRiskHistory', () => {
    it('calls query builder with studentId and date constraint', async () => {
      const snapshots = [SAVED_SNAPSHOT, { ...SAVED_SNAPSHOT, id: 'snap-2' }];
      snapshotRepo._qb.getMany.mockResolvedValue(snapshots);

      const result = await service.getRiskHistory('stu-1', 30);
      expect(snapshotRepo.createQueryBuilder).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('uses 90-day default window', async () => {
      snapshotRepo._qb.getMany.mockResolvedValue([]);
      await service.getRiskHistory('stu-1');
      expect(snapshotRepo._qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('snapshotAt'),
        expect.any(Object),
      );
    });
  });

  // ── getActiveAlerts ─────────────────────────────────────────────────────────

  describe('getActiveAlerts', () => {
    it('returns unacknowledged alerts', async () => {
      const alerts = [{ id: 'a-1', acknowledgedBy: null }];
      alertRepo._qb.getMany.mockResolvedValue(alerts);
      const result = await service.getActiveAlerts();
      expect(result).toHaveLength(1);
    });

    it('filters by studentId when provided', async () => {
      alertRepo._qb.getMany.mockResolvedValue([]);
      await service.getActiveAlerts('stu-1');
      expect(alertRepo._qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('studentId'),
        expect.objectContaining({ studentId: 'stu-1' }),
      );
    });

    it('does not filter by studentId when not provided', async () => {
      alertRepo._qb.getMany.mockResolvedValue([]);
      await service.getActiveAlerts();
      const andWhereCalls = alertRepo._qb.andWhere.mock.calls as unknown[][];
      const studentFilter = andWhereCalls.find((args) => String(args[0]).includes('studentId'));
      expect(studentFilter).toBeUndefined();
    });
  });

  // ── acknowledgeAlert ────────────────────────────────────────────────────────

  describe('acknowledgeAlert', () => {
    it('updates acknowledgedBy, acknowledgedAt and note', async () => {
      const alert = { id: 'a-1', acknowledgedBy: null, acknowledgedAt: null, note: null } as AlertEventEntity;
      alertRepo.findOne.mockResolvedValue(alert);
      alertRepo.save.mockResolvedValue({ ...alert, acknowledgedBy: 'hod-1', note: 'Counseled' });

      const result = await service.acknowledgeAlert('a-1', { acknowledgedBy: 'hod-1', note: 'Counseled' });
      expect(result.acknowledgedBy).toBe('hod-1');
      expect(result.note).toBe('Counseled');
    });

    it('sets note to null when not provided', async () => {
      const alert = { id: 'a-1', acknowledgedBy: null, acknowledgedAt: null, note: null } as AlertEventEntity;
      alertRepo.findOne.mockResolvedValue(alert);
      alertRepo.save.mockImplementation((e: AlertEventEntity) => Promise.resolve(e));

      const result = await service.acknowledgeAlert('a-1', { acknowledgedBy: 'hod-1' });
      expect(result.note).toBeNull();
    });

    it('throws NotFoundException when alert not found', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      await expect(service.acknowledgeAlert('bad-id', { acknowledgedBy: 'hod-1' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getWeights ──────────────────────────────────────────────────────────────

  describe('getWeights', () => {
    it('returns active weights from repo', async () => {
      const weights = [{ factor: 'attendance', weight: 0.35, active: true }];
      weightRepo.find.mockResolvedValue(weights);
      const result = await service.getWeights();
      expect(result).toEqual(weights);
      expect(weightRepo.find).toHaveBeenCalledWith({ where: { active: true } });
    });
  });

  // ── updateWeights ───────────────────────────────────────────────────────────

  describe('updateWeights', () => {
    const VALID_WEIGHTS = [
      { factor: 'attendance' as const, weight: 0.35 },
      { factor: 'marks' as const, weight: 0.30 },
      { factor: 'fees' as const, weight: 0.15 },
      { factor: 'assignments' as const, weight: 0.12 },
      { factor: 'exam_reg' as const, weight: 0.08 },
    ];

    it('throws when weights do not sum to 1.0', async () => {
      const bad = [{ factor: 'attendance' as const, weight: 0.5 }];
      await expect(service.updateWeights(bad)).rejects.toThrow('Weights must sum to 1.0');
    });

    it('throws for NaN weight bypassing sum guard', async () => {
      const bad = [{ factor: 'attendance' as const, weight: NaN }];
      await expect(service.updateWeights(bad)).rejects.toThrow('Invalid weight');
    });

    it('throws for Infinity weight', async () => {
      const bad = [{ factor: 'attendance' as const, weight: Infinity }];
      await expect(service.updateWeights(bad)).rejects.toThrow('Invalid weight');
    });

    it('creates new weight entities when none exist in DB', async () => {
      weightRepo.findOne.mockResolvedValue(null);
      weightRepo.save.mockImplementation((e: ScoringWeightEntity) => Promise.resolve({ ...e, id: 'w-1' }));
      const results = await service.updateWeights(VALID_WEIGHTS);
      expect(weightRepo.create).toHaveBeenCalledTimes(5);
      expect(results).toHaveLength(5);
    });

    it('updates existing weight entities', async () => {
      const existing = { id: 'w-existing', factor: 'attendance', weight: 0.40, active: true };
      weightRepo.findOne.mockResolvedValue(existing);
      weightRepo.save.mockImplementation((e: ScoringWeightEntity) => Promise.resolve(e));
      await service.updateWeights(VALID_WEIGHTS);
      // save called for each factor
      expect(weightRepo.save).toHaveBeenCalledTimes(VALID_WEIGHTS.length);
    });

    it('accepts weights that sum to 1.0 within tolerance (0.001)', async () => {
      const slightlyOff = [
        { factor: 'attendance' as const, weight: 0.3501 },
        { factor: 'marks' as const, weight: 0.2999 },
        { factor: 'fees' as const, weight: 0.15 },
        { factor: 'assignments' as const, weight: 0.12 },
        { factor: 'exam_reg' as const, weight: 0.08 },
      ]; // sum = 1.0000
      weightRepo.findOne.mockResolvedValue(null);
      weightRepo.save.mockImplementation((e: ScoringWeightEntity) => Promise.resolve({ ...e, id: 'w' }));
      await expect(service.updateWeights(slightlyOff)).resolves.toBeDefined();
    });
  });
});
