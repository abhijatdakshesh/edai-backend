/**
 * NaacReportProcessor — unit tests
 * Covers: PROCESSING → DONE path (with snapshots), PROCESSING → DONE with missing criteria,
 *         PROCESSING → FAILED (all missing), FAILED on repo error.
 */

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NaacReportProcessor } from './naac-report.processor';
import { NaacReportEntity } from './entities/naac-report.entity';
import { NaacCriterionSnapshotEntity } from './entities/naac-criterion-snapshot.entity';

const MOCK_REPORT: Partial<NaacReportEntity> = {
  id: 'r-1',
  institutionId: 'inst-1',
  academicYear: '2025-2026',
  status: 'PROCESSING',
};

function makeReportRepo(report: Partial<NaacReportEntity> = MOCK_REPORT) {
  return {
    findOne: jest.fn().mockResolvedValue(report),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

function makeSnapshotRepo(snapshots: Partial<NaacCriterionSnapshotEntity>[] = []) {
  return {
    find: jest.fn().mockResolvedValue(snapshots),
  };
}

function makeJob(data: object) {
  return { data } as never;
}

const FULL_SNAPSHOTS: Partial<NaacCriterionSnapshotEntity>[] = [1, 2, 3, 4, 5, 6, 7].map((c) => ({
  criterion: c as NaacCriterionSnapshotEntity['criterion'],
  score: 100,
  maxScore: 150,
  computedAt: new Date(),
}));

describe('NaacReportProcessor', () => {
  let processor: NaacReportProcessor;
  let reportRepo: ReturnType<typeof makeReportRepo>;
  let snapshotRepo: ReturnType<typeof makeSnapshotRepo>;

  async function build(
    snapshots: Partial<NaacCriterionSnapshotEntity>[] = FULL_SNAPSHOTS,
    report: Partial<NaacReportEntity> = MOCK_REPORT,
  ) {
    reportRepo = makeReportRepo(report);
    snapshotRepo = makeSnapshotRepo(snapshots);
    const module = await Test.createTestingModule({
      providers: [
        NaacReportProcessor,
        { provide: getRepositoryToken(NaacReportEntity), useValue: reportRepo },
        { provide: getRepositoryToken(NaacCriterionSnapshotEntity), useValue: snapshotRepo },
      ],
    }).compile();
    processor = module.get(NaacReportProcessor);
    jest.clearAllMocks();
    reportRepo.update.mockResolvedValue(undefined);
  }

  // ── happy path ────────────────────────────────────────────────────────────

  it('marks PROCESSING then DONE when all 7 criterion snapshots exist', async () => {
    await build(FULL_SNAPSHOTS);
    await processor.process(makeJob({ reportId: 'r-1', academicYear: '2025-2026' }));

    expect(reportRepo.update).toHaveBeenNthCalledWith(1, 'r-1', { status: 'PROCESSING' });
    const doneCall = reportRepo.update.mock.calls.find(
      (c: unknown[]) => (c[1] as { status: string }).status === 'DONE',
    );
    expect(doneCall).toBeDefined();
    expect((doneCall![1] as { s3Key: string }).s3Key).toContain('r-1');
  });

  it('criterion scores are populated from real snapshots', async () => {
    await build(FULL_SNAPSHOTS);
    await processor.process(makeJob({ reportId: 'r-1', academicYear: '2025-2026' }));

    const doneCall = reportRepo.update.mock.calls.find(
      (c: unknown[]) => (c[1] as { status: string }).status === 'DONE',
    );
    const scores = (doneCall![1] as { criterionScores: Record<string, unknown> }).criterionScores;
    for (let c = 1; c <= 7; c++) {
      expect(scores[`criterion${c}`]).toMatchObject({ score: 100, max: 150, dataSource: 'snapshot' });
    }
  });

  it('uses only the latest snapshot per criterion (deduplication)', async () => {
    const snapshots: Partial<NaacCriterionSnapshotEntity>[] = [
      { criterion: 1, score: 200, maxScore: 150, computedAt: new Date('2025-06-01') },
      { criterion: 1, score: 100, maxScore: 150, computedAt: new Date('2025-01-01') },
      ...FULL_SNAPSHOTS.slice(1),
    ];
    await build(snapshots);
    await processor.process(makeJob({ reportId: 'r-1', academicYear: '2025-2026' }));

    const doneCall = reportRepo.update.mock.calls.find(
      (c: unknown[]) => (c[1] as { status: string }).status === 'DONE',
    );
    const scores = (doneCall![1] as { criterionScores: Record<string, { score: number }> }).criterionScores;
    expect(scores['criterion1'].score).toBe(200); // latest wins
  });

  // ── partial data path ─────────────────────────────────────────────────────

  it('marks DONE with partial data when some criteria are missing', async () => {
    await build([FULL_SNAPSHOTS[0]!]); // only criterion 1
    await processor.process(makeJob({ reportId: 'r-1', academicYear: '2025-2026' }));

    const doneCall = reportRepo.update.mock.calls.find(
      (c: unknown[]) => (c[1] as { status: string }).status === 'DONE',
    );
    expect(doneCall).toBeDefined();
    const payload = doneCall![1] as { criterionScores: Record<string, { dataSource: string }>; errorDetail: string };
    expect(payload.criterionScores['criterion1'].dataSource).toBe('snapshot');
    expect(payload.criterionScores['criterion2'].dataSource).toBe('missing');
    expect(payload.errorDetail).toMatch(/6 criteria/);
  });

  // ── all missing → FAILED ──────────────────────────────────────────────────

  it('marks FAILED when no snapshots exist at all', async () => {
    await build([]);
    await processor.process(makeJob({ reportId: 'r-1', academicYear: '2025-2026' }));

    const failCall = reportRepo.update.mock.calls.find(
      (c: unknown[]) => (c[1] as { status: string }).status === 'FAILED',
    );
    expect(failCall).toBeDefined();
    expect((failCall![1] as { errorDetail: string }).errorDetail).toMatch(/No criterion snapshots/);
  });

  // ── report not found ──────────────────────────────────────────────────────

  it('marks FAILED and rethrows when report record not found', async () => {
    await build(FULL_SNAPSHOTS, null as unknown as NaacReportEntity);
    reportRepo.findOne.mockResolvedValue(null);

    await expect(processor.process(makeJob({ reportId: 'missing', academicYear: '2025-2026' }))).rejects.toThrow('not found');
    const failCall = reportRepo.update.mock.calls.find(
      (c: unknown[]) => (c[1] as { status: string }).status === 'FAILED',
    );
    expect(failCall).toBeDefined();
  });
});
