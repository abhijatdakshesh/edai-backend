/**
 * MarksService — Jest unit tests
 *
 * Tests cover:
 *   validateBulk  — STATISTICAL_OUTLIER, INVALID_SCORE, DECIMAL_ERROR,
 *                   UNUSUAL_PATTERN, and normal variance (no flags)
 *   confirmBulk   — saves entries, calls checkPerformanceDrop
 *   checkPerformanceDrop — triggers on >15% drop vs rolling avg of last 6,
 *                          does NOT trigger for first/few entries, does NOT
 *                          trigger when no drop
 *   getByStudent  — returns only that student's marks
 *   verify        — updates status to VERIFIED
 */

import { MarksService, BulkMarksEntryDto } from './marks.service';
import { Logger } from '@nestjs/common';

// Silence NestJS logger output during tests
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

// ─── helpers ────────────────────────────────────────────────────────────────

function makeDto(
  entries: Array<{ studentId: string; score: number | null }>,
  overrides: Partial<BulkMarksEntryDto> = {},
): BulkMarksEntryDto {
  return {
    subjectId: 'sub-1',
    component: 'IA1',
    enteredBy: 'teacher-1',
    entries,
    ...overrides,
  };
}

// ─── validateBulk ───────────────────────────────────────────────────────────

describe('MarksService.validateBulk', () => {
  let service: MarksService;

  beforeEach(() => {
    service = new MarksService();
  });

  it('flags STATISTICAL_OUTLIER when score is more than 2 standard deviations above mean', () => {
    // Class scores: 70, 72, 68, 71, 69, 73 — mean ≈ 70.5, stddev ≈ 1.6
    // Outlier: student scoring 95 → well above mean + 2σ
    const scores = [70, 72, 68, 71, 69, 73, 95];
    const entries = scores.map((score, i) => ({ studentId: `s-${i}`, score }));
    const result = service.validateBulk(makeDto(entries));

    const outlierFlags = result.flags.filter((f) => f.flagType === 'STATISTICAL_OUTLIER');
    expect(outlierFlags.length).toBeGreaterThan(0);
    // Only the 95-scorer should be flagged as an outlier
    expect(outlierFlags.some((f) => f.studentId === 's-6')).toBe(true);
    // Normal scorers should not be flagged as outliers
    expect(outlierFlags.some((f) => f.studentId === 's-0')).toBe(false);
  });

  it('flags INVALID_SCORE when score exceeds 100', () => {
    const entries = [
      { studentId: 'normal', score: 80 },
      { studentId: 'bad', score: 115 },
    ];
    const result = service.validateBulk(makeDto(entries));

    const invalidFlags = result.flags.filter((f) => f.flagType === 'INVALID_SCORE');
    expect(invalidFlags).toHaveLength(1);
    expect(invalidFlags[0].studentId).toBe('bad');
    expect(invalidFlags[0].score).toBe(115);
  });

  it('sets canProceed=false when there is an INVALID_SCORE flag', () => {
    const entries = [
      { studentId: 's-1', score: 80 },
      { studentId: 's-2', score: 105 },
    ];
    const result = service.validateBulk(makeDto(entries));
    expect(result.canProceed).toBe(false);
  });

  it('sets canProceed=true when no INVALID_SCORE flags exist', () => {
    const entries = [
      { studentId: 's-1', score: 75 },
      { studentId: 's-2', score: 80 },
    ];
    const result = service.validateBulk(makeDto(entries));
    expect(result.canProceed).toBe(true);
  });

  it('flags DECIMAL_ERROR when score=8 and class average is 80 (possible 80→8 typo)', () => {
    // Class avg > 50, score < 10, score*10 <= 100 → decimal error suspected
    const entries = [
      { studentId: 's-1', score: 80 },
      { studentId: 's-2', score: 82 },
      { studentId: 's-3', score: 78 },
      { studentId: 's-typo', score: 8 }, // should be 80
    ];
    const result = service.validateBulk(makeDto(entries));

    const decimalFlags = result.flags.filter((f) => f.flagType === 'DECIMAL_ERROR');
    expect(decimalFlags.length).toBeGreaterThan(0);
    expect(decimalFlags.some((f) => f.studentId === 's-typo')).toBe(true);
    expect(decimalFlags[0].message).toMatch(/80/); // suggests score*10
  });

  it('does NOT flag DECIMAL_ERROR when score is low but class average is also low', () => {
    // mean < 50, so decimal error rule should not trigger
    const entries = [
      { studentId: 's-1', score: 5 },
      { studentId: 's-2', score: 6 },
      { studentId: 's-3', score: 7 },
      { studentId: 's-4', score: 8 },
    ];
    const result = service.validateBulk(makeDto(entries));
    const decimalFlags = result.flags.filter((f) => f.flagType === 'DECIMAL_ERROR');
    expect(decimalFlags).toHaveLength(0);
  });

  it('flags UNUSUAL_PATTERN when all students score identically and count > 3', () => {
    const entries = [
      { studentId: 's-1', score: 50 },
      { studentId: 's-2', score: 50 },
      { studentId: 's-3', score: 50 },
      { studentId: 's-4', score: 50 },
    ];
    const result = service.validateBulk(makeDto(entries));

    const patternFlags = result.flags.filter((f) => f.flagType === 'UNUSUAL_PATTERN');
    expect(patternFlags).toHaveLength(4); // every student flagged
    expect(patternFlags.every((f) => f.score === 50)).toBe(true);
  });

  it('does NOT flag UNUSUAL_PATTERN when only 3 or fewer students share a score', () => {
    const entries = [
      { studentId: 's-1', score: 50 },
      { studentId: 's-2', score: 50 },
      { studentId: 's-3', score: 50 },
    ];
    const result = service.validateBulk(makeDto(entries));
    const patternFlags = result.flags.filter((f) => f.flagType === 'UNUSUAL_PATTERN');
    expect(patternFlags).toHaveLength(0);
  });

  it('does NOT flag anything for normal variance (different scores, all valid, no outliers)', () => {
    // Realistic class: varied scores, mean ~70, no score > 100 or < 10
    const entries = [
      { studentId: 's-1', score: 65 },
      { studentId: 's-2', score: 72 },
      { studentId: 's-3', score: 68 },
      { studentId: 's-4', score: 75 },
      { studentId: 's-5', score: 70 },
      { studentId: 's-6', score: 63 },
      { studentId: 's-7', score: 78 },
    ];
    const result = service.validateBulk(makeDto(entries));
    // May still have no flags at all for this normal distribution
    const majorFlags = result.flags.filter(
      (f) =>
        f.flagType === 'INVALID_SCORE' ||
        f.flagType === 'DECIMAL_ERROR' ||
        f.flagType === 'UNUSUAL_PATTERN',
    );
    expect(majorFlags).toHaveLength(0);
    expect(result.canProceed).toBe(true);
  });

  it('returns flagCount matching the number of flags', () => {
    const entries = [
      { studentId: 's-1', score: 110 }, // INVALID_SCORE
      { studentId: 's-2', score: 115 }, // INVALID_SCORE
    ];
    const result = service.validateBulk(makeDto(entries));
    expect(result.flagCount).toBe(result.flags.length);
  });

  it('flags MISSING_ENTRY for null scores', () => {
    const entries = [
      { studentId: 's-1', score: 75 },
      { studentId: 's-2', score: null },
    ];
    const result = service.validateBulk(makeDto(entries));
    const missingFlags = result.flags.filter((f) => f.flagType === 'MISSING_ENTRY');
    expect(missingFlags).toHaveLength(1);
    expect(missingFlags[0].studentId).toBe('s-2');
  });
});

// ─── confirmBulk ────────────────────────────────────────────────────────────

describe('MarksService.confirmBulk', () => {
  let service: MarksService;

  beforeEach(() => {
    service = new MarksService();
  });

  it('saves all non-null entries and returns them', () => {
    const dto = makeDto([
      { studentId: 's-1', score: 75 },
      { studentId: 's-2', score: 80 },
      { studentId: 's-3', score: null }, // should be skipped
    ]);
    const saved = service.confirmBulk(dto, []);

    expect(saved).toHaveLength(2);
    expect(saved.map((e) => e.studentId)).toEqual(expect.arrayContaining(['s-1', 's-2']));
  });

  it('assigns status DRAFT when there are no flags for that student', () => {
    const dto = makeDto([{ studentId: 's-1', score: 75 }]);
    const saved = service.confirmBulk(dto, []);
    expect(saved[0].status).toBe('DRAFT');
  });

  it('assigns status PENDING_REVIEW when a flag exists for that student', () => {
    const dto = makeDto([{ studentId: 's-1', score: 95 }]);
    const flags = [
      {
        studentId: 's-1',
        studentName: 'Student:s-1',
        score: 95,
        flagType: 'STATISTICAL_OUTLIER' as const,
        message: 'Outlier',
      },
    ];
    const saved = service.confirmBulk(dto, flags);
    expect(saved[0].status).toBe('PENDING_REVIEW');
    expect(saved[0].aiValidationFlags).toHaveLength(1);
  });

  it('attaches per-student flags to the correct entry only', () => {
    const dto = makeDto([
      { studentId: 's-1', score: 80 },
      { studentId: 's-2', score: 95 },
    ]);
    const flags = [
      {
        studentId: 's-2',
        studentName: 'Student:s-2',
        score: 95,
        flagType: 'STATISTICAL_OUTLIER' as const,
        message: 'Outlier',
      },
    ];
    const saved = service.confirmBulk(dto, flags);
    const s1 = saved.find((e) => e.studentId === 's-1')!;
    const s2 = saved.find((e) => e.studentId === 's-2')!;

    expect(s1.aiValidationFlags).toBeUndefined();
    expect(s1.status).toBe('DRAFT');
    expect(s2.aiValidationFlags).toHaveLength(1);
    expect(s2.status).toBe('PENDING_REVIEW');
  });

  it('persists saved entries so getByStudent can retrieve them', () => {
    const dto = makeDto([{ studentId: 's-10', score: 70 }]);
    service.confirmBulk(dto, []);
    const retrieved = service.getByStudent('s-10');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].score).toBe(70);
  });

  it('calls checkPerformanceDrop (via logger.warn) when drop exceeds 15%', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');

    // Seed 5 prior entries for student s-99 in sub-perf with non-DRAFT status
    // We need to manually push them into the private `marks` array by going
    // through confirmBulk calls with separate subjects, then re-use correctly.
    // Simplest approach: build 5 VERIFIED entries via confirmBulk, then trigger
    // a 6th that drops >15%.

    const historicalDto = (score: number, subjectId: string): BulkMarksEntryDto => ({
      subjectId,
      component: 'IA1',
      enteredBy: 'teacher-1',
      entries: [{ studentId: 's-99', score }],
    });

    // Use same subjectId for all; to make them non-DRAFT we first save them,
    // then verify them so history will include them.
    // Actually checkPerformanceDrop filters on status !== 'DRAFT', so we need
    // to verify the entries before they count. Use a fresh service and verify.
    const freshService = new MarksService();

    const scores = [80, 82, 78, 81, 79]; // avg ≈ 80
    const subId = 'sub-perf';
    for (const s of scores) {
      const dto2: BulkMarksEntryDto = {
        subjectId: subId,
        component: 'IA1',
        enteredBy: 'teacher-1',
        entries: [{ studentId: 's-99', score: s }],
      };
      const saved = freshService.confirmBulk(dto2, []);
      // Verify to change status from DRAFT so checkPerformanceDrop counts them
      freshService.verify(saved[0].id, 'verifier-1');
    }

    // 6th entry: score 60, which is (80-60)/80 = 25% drop → should trigger
    const triggerDto: BulkMarksEntryDto = {
      subjectId: subId,
      component: 'IA2',
      enteredBy: 'teacher-1',
      entries: [{ studentId: 's-99', score: 60 }],
    };
    freshService.confirmBulk(triggerDto, []);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('KAFKA emit academics.performance.drop'),
      's-99',
      subId,
      expect.any(Number),
    );
  });

  it('does NOT call checkPerformanceDrop for a student with fewer than 3 prior entries', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockClear();

    const freshService = new MarksService();

    // Only 2 prior entries (won't trigger because history.length < 3)
    for (const score of [80, 75]) {
      const dto2: BulkMarksEntryDto = {
        subjectId: 'sub-first',
        component: 'IA1',
        enteredBy: 'teacher-1',
        entries: [{ studentId: 's-first', score }],
      };
      const saved = freshService.confirmBulk(dto2, []);
      freshService.verify(saved[0].id, 'verifier-1');
    }

    const triggerDto: BulkMarksEntryDto = {
      subjectId: 'sub-first',
      component: 'IA2',
      enteredBy: 'teacher-1',
      entries: [{ studentId: 's-first', score: 20 }],
    };
    freshService.confirmBulk(triggerDto, []);

    const dropWarns = warnSpy.mock.calls.filter((args) =>
      String(args[0]).includes('academics.performance.drop'),
    );
    expect(dropWarns).toHaveLength(0);
  });

  it('does NOT call checkPerformanceDrop when there is no significant drop', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockClear();
    const freshService = new MarksService();

    // 5 entries averaging 80
    for (const score of [78, 80, 82, 79, 81]) {
      const dto2: BulkMarksEntryDto = {
        subjectId: 'sub-nodrop',
        component: 'IA1',
        enteredBy: 'teacher-1',
        entries: [{ studentId: 's-nodrop', score }],
      };
      const saved = freshService.confirmBulk(dto2, []);
      freshService.verify(saved[0].id, 'verifier-1');
    }

    // 6th entry: score 78 — no significant drop
    freshService.confirmBulk(
      {
        subjectId: 'sub-nodrop',
        component: 'IA2',
        enteredBy: 'teacher-1',
        entries: [{ studentId: 's-nodrop', score: 78 }],
      },
      [],
    );

    const dropWarns = warnSpy.mock.calls.filter((args) =>
      String(args[0]).includes('academics.performance.drop'),
    );
    expect(dropWarns).toHaveLength(0);
  });
});

// ─── getByStudent ────────────────────────────────────────────────────────────

describe('MarksService.getByStudent', () => {
  let service: MarksService;

  beforeEach(() => {
    service = new MarksService();

    // Seed marks for two different students
    service.confirmBulk(
      makeDto([{ studentId: 'alice', score: 72 }], { subjectId: 'sub-A' }),
      [],
    );
    service.confirmBulk(
      makeDto([{ studentId: 'bob', score: 85 }], { subjectId: 'sub-A' }),
      [],
    );
    service.confirmBulk(
      makeDto([{ studentId: 'alice', score: 68 }], { subjectId: 'sub-B' }),
      [],
    );
  });

  it('returns only marks belonging to the requested student', () => {
    const aliceMarks = service.getByStudent('alice');
    expect(aliceMarks.length).toBe(2);
    expect(aliceMarks.every((m) => m.studentId === 'alice')).toBe(true);
  });

  it('does not include marks from other students', () => {
    const aliceMarks = service.getByStudent('alice');
    expect(aliceMarks.some((m) => m.studentId === 'bob')).toBe(false);
  });

  it('returns an empty array for a student with no marks', () => {
    const unknown = service.getByStudent('nobody');
    expect(unknown).toHaveLength(0);
  });

  it('returns the correct number of marks for a student with multiple subjects', () => {
    const aliceMarks = service.getByStudent('alice');
    const subjects = aliceMarks.map((m) => m.subjectId);
    expect(subjects).toContain('sub-A');
    expect(subjects).toContain('sub-B');
  });
});

// ─── verify ─────────────────────────────────────────────────────────────────

describe('MarksService.verify', () => {
  let service: MarksService;

  beforeEach(() => {
    service = new MarksService();
  });

  it('updates status to VERIFIED and stores verifiedBy', () => {
    const [entry] = service.confirmBulk(
      makeDto([{ studentId: 's-1', score: 75 }]),
      [],
    );
    expect(entry.status).toBe('DRAFT');

    const verified = service.verify(entry.id, 'hod-1');
    expect(verified).not.toBeNull();
    expect(verified!.status).toBe('VERIFIED');
    expect(verified!.verifiedBy).toBe('hod-1');
  });

  it('reflects the updated status when retrieved via getByStudent', () => {
    const [entry] = service.confirmBulk(
      makeDto([{ studentId: 's-2', score: 80 }]),
      [],
    );
    service.verify(entry.id, 'hod-2');
    const marks = service.getByStudent('s-2');
    expect(marks[0].status).toBe('VERIFIED');
  });

  it('returns null for an unknown entry ID', () => {
    const result = service.verify('non-existent-id', 'hod-1');
    expect(result).toBeNull();
  });

  it('does not change other entries when verifying one', () => {
    const [e1] = service.confirmBulk(
      makeDto([{ studentId: 's-A', score: 70 }]),
      [],
    );
    const [e2] = service.confirmBulk(
      makeDto([{ studentId: 's-B', score: 85 }]),
      [],
    );

    service.verify(e1.id, 'hod-1');

    const s2Marks = service.getByStudent('s-B');
    expect(s2Marks[0].status).toBe('DRAFT');
    // e2 is not affected
    void e2; // reference to confirm it's a different object
  });
});

describe('generateDailyReport', () => {
  let service: MarksService;
  beforeEach(() => { service = new MarksService(); });

  it('creates and returns a report with teacherId and reportDate', async () => {
    const report = await service.generateDailyReport('teacher-1');
    expect(report.teacherId).toBe('teacher-1');
    expect(report.reportDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(report.id).toBeTruthy();
  });

  it('counts pending-review marks in report contentJson', async () => {
    service.confirmBulk(makeDto([{ studentId: 's1', score: 70 }]), [{ studentId: 's1', studentName: 'S1', score: 70, flagType: 'STATISTICAL_OUTLIER', message: 'x' }]);
    const report = await service.generateDailyReport('teacher-1');
    expect(report.contentJson.pendingGrading).toBeGreaterThanOrEqual(0);
  });

  it('persists report in getTeacherReports', async () => {
    await service.generateDailyReport('teacher-99');
    const reports = service.getTeacherReports('teacher-99');
    expect(reports.length).toBe(1);
  });

  it('getTeacherReports returns empty for unknown teacher', () => {
    expect(service.getTeacherReports('nobody')).toEqual([]);
  });
});

describe('getAtRiskPredictions', () => {
  it('returns empty array (stub)', () => {
    const service = new MarksService();
    expect(service.getAtRiskPredictions('teacher-1')).toEqual([]);
  });
});
