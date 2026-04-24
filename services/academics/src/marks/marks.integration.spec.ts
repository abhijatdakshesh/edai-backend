/**
 * marks.integration.spec.ts
 *
 * Integration tests for MarksService — exercises cross-method workflows using
 * the real in-memory store (no DB, no service mocks).
 *
 * Scenarios:
 *   1. Full entry + AI validation + confirm + verify + performance-drop detection
 *   2. Bulk marks for 10 students: unique IDs, per-student isolation
 *   3. Promotion eligibility: PromotionService + MarksService data alignment
 */

import { MarksService, BulkMarksEntryDto } from './marks.service';
import { PromotionService } from '../promotion/promotion.service';
import { Logger } from '@nestjs/common';

// Silence NestJS logger output
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

// ─── helpers ────────────────────────────────────────────────────────────────

function makeDto(
  entries: Array<{ studentId: string; score: number | null }>,
  overrides: Partial<BulkMarksEntryDto> = {},
): BulkMarksEntryDto {
  return {
    subjectId: 'sub-default',
    component: 'IA1',
    enteredBy: 'teacher-int',
    entries,
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Full marks entry + validation + performance drop workflow', () => {
  let service: MarksService;

  beforeEach(() => {
    service = new MarksService();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 1 — validate → confirm → verify → performance drop
  // ════════════════════════════════════════════════════════════════════════════

  it('teacher enters marks → AI validates → teacher confirms → flagged=PENDING_REVIEW, unflagged=DRAFT → verify → VERIFIED', async () => {
    const subjectId = 'sub-MARKS-INT-1';
    const normalStudentId = 'int-stu-n1';
    const outlierStudentId = 'int-stu-o1';

    // Build a class where one student is an obvious statistical outlier.
    // Normal cluster: 70-73 (7 students), outlier: 3 (far below mean ~72, stddev ~1.4)
    const normalScores = [70, 71, 72, 73, 71, 70, 72];
    const normalEntries = normalScores.map((score, i) => ({
      studentId: `int-stu-norm-${i}`,
      score,
    }));
    const allEntries = [
      ...normalEntries,
      { studentId: normalStudentId, score: 72 }, // another normal student
      { studentId: outlierStudentId, score: 3 }, // outlier: far below mean, also decimal error (class avg > 50)
    ];

    const dto = makeDto(allEntries, { subjectId });

    // Step 1: validate — should flag the outlier
    const validation = service.validateBulk(dto);
    expect(validation.flagCount).toBeGreaterThan(0);

    // outlierStudentId should be flagged (STATISTICAL_OUTLIER or DECIMAL_ERROR)
    const outlierFlags = validation.flags.filter(
      (f) => f.studentId === outlierStudentId,
    );
    expect(outlierFlags.length).toBeGreaterThan(0);

    // Normal student should NOT have STATISTICAL_OUTLIER or DECIMAL_ERROR flags
    const normalFlags = validation.flags.filter(
      (f) => f.studentId === normalStudentId,
    );
    const seriousNormalFlags = normalFlags.filter(
      (f) => f.flagType === 'STATISTICAL_OUTLIER' || f.flagType === 'DECIMAL_ERROR',
    );
    expect(seriousNormalFlags).toHaveLength(0);

    // Step 2: teacher confirms — pass the flags from validation
    const saved = service.confirmBulk(dto, validation.flags);

    // Step 3: assert flagged student → PENDING_REVIEW, normal student → DRAFT
    const outlierEntry = saved.find((e) => e.studentId === outlierStudentId);
    const normalEntry = saved.find((e) => e.studentId === normalStudentId);

    expect(outlierEntry).toBeDefined();
    expect(outlierEntry!.status).toBe('PENDING_REVIEW');
    expect(outlierEntry!.aiValidationFlags).toBeDefined();
    expect(outlierEntry!.aiValidationFlags!.length).toBeGreaterThan(0);

    expect(normalEntry).toBeDefined();
    expect(normalEntry!.status).toBe('DRAFT');
    expect(normalEntry!.aiValidationFlags).toBeUndefined();

    // Step 4: verify the flagged entry → VERIFIED
    const verified = service.verify(outlierEntry!.id, 'hod-int');
    expect(verified).not.toBeNull();
    expect(verified!.status).toBe('VERIFIED');
    expect(verified!.verifiedBy).toBe('hod-int');

    // Retrieve via getByStudent to confirm persistence
    const outlierHistory = service.getByStudent(outlierStudentId);
    expect(outlierHistory).toHaveLength(1);
    expect(outlierHistory[0].status).toBe('VERIFIED');
  });

  it('performance drop is detected when new marks are >15% below rolling average', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');
    const subjectId = 'sub-MARKS-DROP';
    const studentId = 'int-stu-drop';

    // Enter 5 marks around 80 and verify them (non-DRAFT required for history)
    for (const score of [80, 82, 78, 81, 79]) {
      const saved = service.confirmBulk(
        makeDto([{ studentId, score }], { subjectId, component: 'IA1' }),
        [],
      );
      service.verify(saved[0].id, 'hod-int');
    }

    // New entry: score 60, avg ~80 → drop = (80-60)/80 = 25% > 15% → should trigger
    service.confirmBulk(
      makeDto([{ studentId, score: 60 }], { subjectId, component: 'IA2' }),
      [],
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('KAFKA emit academics.performance.drop'),
      studentId,
      subjectId,
      expect.any(Number),
    );
  });

  it('performance drop is NOT triggered when new marks are within 15% of rolling average', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockClear();
    const subjectId = 'sub-MARKS-NODROP';
    const studentId = 'int-stu-nodrop';

    for (const score of [78, 80, 82, 79, 81]) {
      const saved = service.confirmBulk(
        makeDto([{ studentId, score }], { subjectId, component: 'IA1' }),
        [],
      );
      service.verify(saved[0].id, 'hod-int');
    }

    // score 77 — about 3% below avg 80: no drop
    service.confirmBulk(
      makeDto([{ studentId, score: 77 }], { subjectId, component: 'IA2' }),
      [],
    );

    const dropWarns = warnSpy.mock.calls.filter((args) =>
      String(args[0]).includes('academics.performance.drop'),
    );
    expect(dropWarns).toHaveLength(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 2 — bulk marks for 10 students: unique IDs, student isolation
  // ════════════════════════════════════════════════════════════════════════════

  it('bulk marks for 10 students: each gets a unique ID, student isolation maintained', () => {
    const subjectId = 'sub-BULK-10';
    const studentIds = Array.from({ length: 10 }, (_, i) => `bulk-stu-${i}`);
    const entries = studentIds.map((studentId, i) => ({
      studentId,
      score: 60 + i, // scores 60..69
    }));

    const dto = makeDto(entries, { subjectId });
    const validation = service.validateBulk(dto);

    // All scores are valid (60-69), no flags expected
    const invalidFlags = validation.flags.filter((f) => f.flagType === 'INVALID_SCORE');
    expect(invalidFlags).toHaveLength(0);

    const saved = service.confirmBulk(dto, validation.flags);

    // All 10 entries saved
    expect(saved).toHaveLength(10);

    // Every saved entry has a unique ID
    const ids = saved.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);

    // Each entry belongs to the correct student
    for (let i = 0; i < 10; i++) {
      const entry = saved.find((e) => e.studentId === studentIds[i]);
      expect(entry).toBeDefined();
      expect(entry!.score).toBe(60 + i);
    }

    // Student isolation: getByStudent returns only records for that student
    for (const studentId of studentIds) {
      const byStudent = service.getByStudent(studentId);
      expect(byStudent).toHaveLength(1);
      expect(byStudent[0].studentId).toBe(studentId);
    }

    // getBySubject returns all 10
    const bySubject = service.getBySubject(subjectId);
    expect(bySubject).toHaveLength(10);
  });

  it('marks entered for different subjects do not cross-contaminate getBySubject', () => {
    const studentId = 'int-cross-stu';

    service.confirmBulk(
      makeDto([{ studentId, score: 75 }], { subjectId: 'sub-A', component: 'IA1' }),
      [],
    );
    service.confirmBulk(
      makeDto([{ studentId, score: 80 }], { subjectId: 'sub-B', component: 'IA1' }),
      [],
    );

    const subA = service.getBySubject('sub-A');
    const subB = service.getBySubject('sub-B');

    expect(subA).toHaveLength(1);
    expect(subA[0].subjectId).toBe('sub-A');
    expect(subA[0].score).toBe(75);

    expect(subB).toHaveLength(1);
    expect(subB[0].subjectId).toBe('sub-B');
    expect(subB[0].score).toBe(80);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 3 — PromotionService uses IA score correctly
  // ════════════════════════════════════════════════════════════════════════════

  it('promotion eligibility: PromotionService evaluates MOCK_STUDENT_DATA correctly with custom minIaScore', () => {
    // PromotionService uses MOCK_STUDENT_DATA (hardcoded); it does NOT query
    // MarksService directly in Phase 1 — but we can still test that
    // generateEligibilityReport correctly applies minIaScore criteria and
    // that a strict threshold detains students who would otherwise be eligible.

    const promotionService = new PromotionService();

    // Default criteria: minAttendancePct=75, minIaScore=40
    const batch = promotionService.generateEligibilityReport({
      classId: 'cls-CSEP5',
      className: '5th Sem CSE',
      fromSemester: 5,
      academicYear: '2025-26',
    });

    // Basic shape assertions
    expect(batch.id).toBeDefined();
    expect(batch.classId).toBe('cls-CSEP5');
    expect(batch.fromSemester).toBe(5);
    expect(batch.toSemester).toBe(6);
    expect(batch.students.length).toBeGreaterThan(0);

    // MOCK students with iaScore >= 40 AND attendancePct >= 75 AND feeCleared should be ELIGIBLE
    for (const student of batch.students) {
      if (student.attendancePct >= 75 && student.iaScore >= 40 && student.feeCleared) {
        expect(student.status).toBe('ELIGIBLE');
        expect(student.failedCriteria).toHaveLength(0);
      }
    }

    // Stats should sum to total
    const { stats } = batch;
    expect(stats.total).toBe(batch.students.length);
    expect(stats.eligible + stats.detained + stats.conditional + stats.promoted).toBe(stats.total);

    // Strict criteria: minIaScore=70 — should detain more students
    const strictBatch = promotionService.generateEligibilityReport({
      classId: 'cls-CSEP5-strict',
      className: '5th Sem CSE Strict',
      fromSemester: 5,
      academicYear: '2025-26',
      criteria: { minIaScore: 70 },
    });

    const strictDetained = strictBatch.students.filter((s) => s.failedCriteria.includes('IA_BELOW_MIN'));
    const defaultDetained = batch.students.filter((s) => s.failedCriteria.includes('IA_BELOW_MIN'));

    // With a higher bar, at least as many students should fail IA criterion
    expect(strictDetained.length).toBeGreaterThanOrEqual(defaultDetained.length);
  });

  it('promotion batch: duplicate generation for same class+semester is rejected', () => {
    const promotionService = new PromotionService();

    promotionService.generateEligibilityReport({
      classId: 'cls-DUP',
      className: 'Dup Class',
      fromSemester: 4,
      academicYear: '2025-26',
    });

    // Second call for same class+semester should throw
    expect(() =>
      promotionService.generateEligibilityReport({
        classId: 'cls-DUP',
        className: 'Dup Class',
        fromSemester: 4,
        academicYear: '2025-26',
      }),
    ).toThrow(/already exists/i);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 4 — full round-trip: validate → confirm → getByStudent → verify → getByStudent
  // ════════════════════════════════════════════════════════════════════════════

  it('full round-trip: validate → confirm (flagged) → getByStudent → verify → status transitions correctly', () => {
    const subjectId = 'sub-ROUND-TRIP';
    const flaggedStudent = 'int-rt-flagged';
    const cleanStudent = 'int-rt-clean';

    // Cluster of normal scores + 1 outlier to ensure flag is triggered
    const entries = [
      { studentId: 'rt-n1', score: 70 },
      { studentId: 'rt-n2', score: 72 },
      { studentId: 'rt-n3', score: 68 },
      { studentId: 'rt-n4', score: 71 },
      { studentId: 'rt-n5', score: 69 },
      { studentId: 'rt-n6', score: 73 },
      { studentId: cleanStudent, score: 71 },
      { studentId: flaggedStudent, score: 3 }, // decimal error candidate (avg ~71, score < 10)
    ];

    const dto = makeDto(entries, { subjectId });
    const validation = service.validateBulk(dto);

    // flaggedStudent should have flags; cleanStudent should not
    const flaggedStudentFlags = validation.flags.filter((f) => f.studentId === flaggedStudent);
    expect(flaggedStudentFlags.length).toBeGreaterThan(0);

    const cleanStudentFlags = validation.flags.filter(
      (f) =>
        f.studentId === cleanStudent &&
        (f.flagType === 'STATISTICAL_OUTLIER' || f.flagType === 'DECIMAL_ERROR'),
    );
    expect(cleanStudentFlags).toHaveLength(0);

    // Confirm
    const saved = service.confirmBulk(dto, validation.flags);

    // Verify round-trip via getByStudent
    const flaggedRecords = service.getByStudent(flaggedStudent);
    expect(flaggedRecords).toHaveLength(1);
    expect(flaggedRecords[0].status).toBe('PENDING_REVIEW');

    const cleanRecords = service.getByStudent(cleanStudent);
    expect(cleanRecords).toHaveLength(1);
    expect(cleanRecords[0].status).toBe('DRAFT');

    // Verify the flagged entry
    const verifyResult = service.verify(flaggedRecords[0].id, 'hod-rt');
    expect(verifyResult!.status).toBe('VERIFIED');

    // Confirm via getByStudent that status persists
    const updatedFlagged = service.getByStudent(flaggedStudent);
    expect(updatedFlagged[0].status).toBe('VERIFIED');

    // Clean student still DRAFT (unaffected)
    const updatedClean = service.getByStudent(cleanStudent);
    expect(updatedClean[0].status).toBe('DRAFT');
  });
});
