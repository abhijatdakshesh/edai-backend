/**
 * NaacService — unit tests (100% coverage)
 *
 * All repos and BullMQ queue are mocked.
 * Covers: generateReport, getReport, listReports,
 *         computeAndSaveCriterion2/3, getDashboard,
 *         saveSnapshot upsert vs insert paths.
 */

import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { NaacService } from './naac.service';
import { NaacCriterionCalculatorService } from './naac-criterion-calculator.service';
import { NaacReportEntity } from './entities/naac-report.entity';
import { NaacCriterionSnapshotEntity } from './entities/naac-criterion-snapshot.entity';
import { NAAC_REPORT_QUEUE } from './naac-report.processor';

// ─── mock factories ──────────────────────────────────────────────────────────

function makeQb() {
  const qb: Record<string, jest.Mock> = {};
  ['where', 'andWhere', 'orderBy', 'getMany'].forEach((m) => {
    qb[m] = jest.fn().mockReturnThis();
  });
  qb['getMany'] = jest.fn().mockResolvedValue([]);
  return qb;
}

function makeRepo<T>() {
  const qb = makeQb();
  return {
    create: jest.fn().mockImplementation((e: Partial<T>) => ({ ...e } as T)),
    save: jest.fn().mockImplementation((e: T) => Promise.resolve({ id: 'saved-id', ...e })),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
  };
}

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

const CRITERION2_INPUT = {
  totalStudents: 2000, totalFaculty: 140, averageAttendancePct: 78,
  facultyWithPhDPct: 42, syllabusCoveragePct: 85, passPercentage: 82,
};

const CRITERION3_INPUT = {
  peerReviewedPublications: 220, fundedProjects: 8, totalFaculty: 140,
  patentsFiled: 3, researchFundingLakhs: 18,
};

// ─── suite ───────────────────────────────────────────────────────────────────

describe('NaacService', () => {
  let service: NaacService;
  let reportRepo: ReturnType<typeof makeRepo<NaacReportEntity>>;
  let snapshotRepo: ReturnType<typeof makeRepo<NaacCriterionSnapshotEntity>>;
  let calculator: NaacCriterionCalculatorService;

  beforeEach(async () => {
    reportRepo = makeRepo<NaacReportEntity>();
    snapshotRepo = makeRepo<NaacCriterionSnapshotEntity>();

    const module = await Test.createTestingModule({
      providers: [
        NaacService,
        NaacCriterionCalculatorService,
        { provide: getRepositoryToken(NaacReportEntity), useValue: reportRepo },
        { provide: getRepositoryToken(NaacCriterionSnapshotEntity), useValue: snapshotRepo },
        { provide: getQueueToken(NAAC_REPORT_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get(NaacService);
    calculator = module.get(NaacCriterionCalculatorService);
    jest.clearAllMocks();
    mockQueue.add.mockResolvedValue({ id: 'job-1' });
  });

  // ── generateReport ──────────────────────────────────────────────────────────

  describe('generateReport', () => {
    beforeEach(() => {
      reportRepo.save.mockResolvedValue({ id: 'report-1', status: 'PENDING', academicYear: '2025-2026', format: 'PDF', generatedBy: 'admin-1' } as NaacReportEntity);
    });

    it('saves report with PENDING status', async () => {
      await service.generateReport({ academicYear: '2025-2026', generatedBy: 'admin-1', format: 'PDF' });
      expect(reportRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
      expect(reportRepo.save).toHaveBeenCalledTimes(1);
    });

    it('adds a job to the NAAC report queue', async () => {
      await service.generateReport({ academicYear: '2025-2026', generatedBy: 'admin-1', format: 'PDF' });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'generate',
        expect.objectContaining({ reportId: 'report-1', academicYear: '2025-2026' }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('returns the saved report entity', async () => {
      const result = await service.generateReport({ academicYear: '2025-2026', generatedBy: 'admin-1', format: 'PDF' });
      expect(result.id).toBe('report-1');
      expect(result.status).toBe('PENDING');
    });
  });

  // ── getReport ───────────────────────────────────────────────────────────────

  describe('getReport', () => {
    it('returns report by id', async () => {
      const report = { id: 'r-1', status: 'DONE' } as NaacReportEntity;
      reportRepo.findOne.mockResolvedValue(report);
      const result = await service.getReport('r-1');
      expect(result.id).toBe('r-1');
    });

    it('throws NotFoundException for unknown id', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      await expect(service.getReport('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── listReports ─────────────────────────────────────────────────────────────

  describe('listReports', () => {
    it('returns list of reports ordered DESC by triggeredAt', async () => {
      const reports = [{ id: 'r-1' }, { id: 'r-2' }] as NaacReportEntity[];
      reportRepo._qb.getMany.mockResolvedValue(reports);
      const result = await service.listReports();
      expect(result).toHaveLength(2);
      expect(reportRepo._qb.orderBy).toHaveBeenCalledWith('r.triggeredAt', 'DESC');
    });

    it('filters by academicYear when provided', async () => {
      reportRepo._qb.getMany.mockResolvedValue([]);
      await service.listReports('2025-2026');
      expect(reportRepo._qb.where).toHaveBeenCalledWith(
        expect.stringContaining('academicYear'),
        { academicYear: '2025-2026' },
      );
    });

    it('does not add where clause when academicYear not provided', async () => {
      reportRepo._qb.getMany.mockResolvedValue([]);
      await service.listReports();
      expect(reportRepo._qb.where).not.toHaveBeenCalled();
    });
  });

  // ── computeAndSaveCriterion2 ────────────────────────────────────────────────

  describe('computeAndSaveCriterion2', () => {
    it('calls calculator and saves snapshot', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);
      const saved = { id: 'snap-1', criterion: 2, score: 150 } as NaacCriterionSnapshotEntity;
      snapshotRepo.save.mockResolvedValue(saved);

      const result = await service.computeAndSaveCriterion2({
        academicYear: '2025-2026',
        dataPeriodEnd: '2026-03-31',
        input: CRITERION2_INPUT,
      });
      expect(result.id).toBe('snap-1');
      expect(snapshotRepo.save).toHaveBeenCalledTimes(1);
    });

    it('updates existing snapshot (upsert path)', async () => {
      const existing = { id: 'existing', criterion: 2, score: 100, maxScore: 240 } as NaacCriterionSnapshotEntity;
      snapshotRepo.findOne.mockResolvedValue(existing);
      snapshotRepo.save.mockResolvedValue({ ...existing, score: 150 });

      await service.computeAndSaveCriterion2({
        academicYear: '2025-2026',
        dataPeriodEnd: '2026-03-31',
        input: CRITERION2_INPUT,
      });
      expect(snapshotRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'existing' }));
    });
  });

  // ── computeAndSaveCriterion3 ────────────────────────────────────────────────

  describe('computeAndSaveCriterion3', () => {
    it('saves criterion 3 snapshot', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);
      snapshotRepo.save.mockResolvedValue({ id: 'snap-3', criterion: 3, score: 60 } as NaacCriterionSnapshotEntity);

      const result = await service.computeAndSaveCriterion3({
        academicYear: '2025-2026',
        dataPeriodEnd: '2026-03-31',
        input: CRITERION3_INPUT,
      });
      expect(result.criterion).toBe(3);
    });
  });

  // ── getDashboard ────────────────────────────────────────────────────────────

  describe('getDashboard', () => {
    it('returns dashboard with all 7 criteria, populating scores for those with snapshots', async () => {
      const snapshots: Partial<NaacCriterionSnapshotEntity>[] = [
        { criterion: 2, score: 180, maxScore: 240, computedAt: new Date('2025-01-01') },
        { criterion: 3, score: 72, maxScore: 100, computedAt: new Date('2025-01-01') },
      ];
      snapshotRepo._qb.getMany.mockResolvedValue(snapshots);

      const result = await service.getDashboard('2025-2026');
      expect(result.academicYear).toBe('2025-2026');
      expect(result.criteria).toHaveLength(7);
      const c2 = result.criteria.find((c) => c.criterion === 2)!;
      expect(c2.score).toBe(180);
      expect(c2.pct).toBeCloseTo(75, 0);
      // Criteria without snapshots still appear with null score but known maxScore
      const c1 = result.criteria.find((c) => c.criterion === 1)!;
      expect(c1.score).toBeNull();
      expect(c1.maxScore).toBe(150);
    });

    it('returns null scores for criteria with no snapshots', async () => {
      snapshotRepo._qb.getMany.mockResolvedValue([]);
      const result = await service.getDashboard('2024-2025');
      expect(result.criteria.every((c) => c.score === null)).toBe(true);
    });

    it('uses only the latest snapshot per criterion', async () => {
      // Two criterion-2 snapshots — only first (most recent) should be used
      const snapshots: Partial<NaacCriterionSnapshotEntity>[] = [
        { criterion: 2, score: 200, maxScore: 240, computedAt: new Date('2025-06-01') },
        { criterion: 2, score: 150, maxScore: 240, computedAt: new Date('2025-01-01') },
      ];
      snapshotRepo._qb.getMany.mockResolvedValue(snapshots);
      const result = await service.getDashboard('2025-2026');
      const c2 = result.criteria.find((c) => c.criterion === 2)!;
      expect(c2.score).toBe(200); // latest wins
    });
  });
});
