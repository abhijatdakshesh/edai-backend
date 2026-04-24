/**
 * attendance.service.spec.ts
 *
 * Comprehensive unit tests for AttendanceService.
 *
 * Coverage targets
 * ─────────────────
 * VTU eligibility  – boundary maths (75.00 / 74.99 / 100 / 0 / 0-classes)
 * markAttendance   – single record, ABSENT triggers callScheduled
 * markBulk         – multiple records, absentCount aggregation
 * excuseAbsence    – status mutation & unknown id guard
 * getStudentSummary – correct percentage arithmetic
 * getClassSummary  – correct percentage arithmetic, late counting
 * getAtRisk        – 7-day rolling window, ≥3 absences threshold
 * getClassAtRisk   – below-75% filter, absence-pct rounding
 * getClassToday    – date filter
 * getAbsenteesToday – date + status filter
 * updateAbsenceReason – mutates the right record
 * runEscalationEngine – DAY3 / DAY5 / DAY7 / DAY10 thresholds,
 *                       deduplication, and 0-absence student guard
 */

import 'reflect-metadata';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto, MarkBulkAttendanceDto } from '../dto/attendance.dto';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Returns an ISO date string N days ago (or 0 = today). */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const TODAY = daysAgo(0);

/** Minimal valid MarkAttendanceDto */
function makeDto(overrides: Partial<MarkAttendanceDto> = {}): MarkAttendanceDto {
  return {
    studentId: 'stu-001',
    classId: 'cls-CS101',
    subjectId: 'sub-MATH',
    date: TODAY,
    period: 1,
    status: 'PRESENT',
    markedBy: 'teacher-001',
    ...overrides,
  };
}

// ─── AttendanceService ───────────────────────────────────────────────────────

describe('AttendanceService', () => {
  let service: AttendanceService;

  // Spy on the private logger so log/debug output does not clutter test output
  beforeEach(() => {
    service = new AttendanceService();
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // markAttendance
  // ══════════════════════════════════════════════════════════════════════════

  describe('markAttendance', () => {
    it('creates a record and returns a recordId', async () => {
      const result = await service.markAttendance(makeDto({ status: 'PRESENT' }));
      expect(result.recordId).toBeDefined();
      expect(typeof result.recordId).toBe('string');
      expect(result.recordId.length).toBeGreaterThan(0);
    });

    it('callScheduled is false when student is PRESENT', async () => {
      const result = await service.markAttendance(makeDto({ status: 'PRESENT' }));
      expect(result.callScheduled).toBe(false);
    });

    it('callScheduled is true when student is ABSENT', async () => {
      const result = await service.markAttendance(makeDto({ status: 'ABSENT' }));
      expect(result.callScheduled).toBe(true);
    });

    it('stores the record in the in-memory array', async () => {
      await service.markAttendance(makeDto({ studentId: 'stu-store-test' }));
      const summary = await service.getStudentSummary('stu-store-test');
      expect(summary.total).toBe(1);
    });

    it('each call creates a distinct record (unique ids)', async () => {
      const r1 = await service.markAttendance(makeDto({ studentId: 'stu-dup' }));
      const r2 = await service.markAttendance(makeDto({ studentId: 'stu-dup' }));
      expect(r1.recordId).not.toBe(r2.recordId);
    });

    it('defaults source to MANUAL when not provided', async () => {
      await service.markAttendance(makeDto({ source: undefined }));
      const records: any[] = (service as any).records;
      const last = records[records.length - 1];
      expect(last.source).toBe('MANUAL');
    });

    it('respects an explicit source value', async () => {
      await service.markAttendance(makeDto({ source: 'BIOMETRIC' }));
      const records: any[] = (service as any).records;
      const last = records[records.length - 1];
      expect(last.source).toBe('BIOMETRIC');
    });

    it('sets callTriggered=true on the stored record when ABSENT', async () => {
      const result = await service.markAttendance(makeDto({ status: 'ABSENT' }));
      const records: any[] = (service as any).records;
      const rec = records.find((r: any) => r.id === result.recordId);
      expect(rec.callTriggered).toBe(true);
    });

    it('sets callTriggered=false on the stored record when PRESENT', async () => {
      const result = await service.markAttendance(makeDto({ status: 'PRESENT' }));
      const records: any[] = (service as any).records;
      const rec = records.find((r: any) => r.id === result.recordId);
      expect(rec.callTriggered).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // markBulk
  // ══════════════════════════════════════════════════════════════════════════

  describe('markBulk', () => {
    const bulkDto: MarkBulkAttendanceDto = {
      classId: 'cls-CS101',
      date: TODAY,
      period: 2,
      subjectId: 'sub-MATH',
      markedBy: 'teacher-001',
      records: [
        { studentId: 'stu-A', status: 'PRESENT' },
        { studentId: 'stu-B', status: 'ABSENT' },
        { studentId: 'stu-C', status: 'ABSENT' },
        { studentId: 'stu-D', status: 'LATE' },
      ],
    };

    it('returns processed count equal to records length', async () => {
      const result = await service.markBulk(bulkDto);
      expect(result.processed).toBe(4);
    });

    it('correctly counts absent students', async () => {
      const result = await service.markBulk(bulkDto);
      expect(result.absentCount).toBe(2);
    });

    it('creates a record for every entry in the bulk dto', async () => {
      await service.markBulk(bulkDto);
      const records: any[] = (service as any).records;
      const classRecords = records.filter((r: any) => r.classId === 'cls-CS101');
      expect(classRecords.length).toBe(4);
    });

    it('zero absent students → absentCount is 0', async () => {
      const allPresent: MarkBulkAttendanceDto = {
        classId: 'cls-ALL-PRESENT',
        date: TODAY,
        period: 1,
        markedBy: 'teacher-001',
        records: [
          { studentId: 'stu-X', status: 'PRESENT' },
          { studentId: 'stu-Y', status: 'PRESENT' },
        ],
      };
      const result = await service.markBulk(allPresent);
      expect(result.absentCount).toBe(0);
      expect(result.processed).toBe(2);
    });

    it('empty records array → processed 0, absentCount 0', async () => {
      const emptyDto: MarkBulkAttendanceDto = {
        classId: 'cls-EMPTY',
        date: TODAY,
        period: 1,
        markedBy: 'teacher-001',
        records: [],
      };
      const result = await service.markBulk(emptyDto);
      expect(result.processed).toBe(0);
      expect(result.absentCount).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // excuseAbsence
  // ══════════════════════════════════════════════════════════════════════════

  describe('excuseAbsence', () => {
    it('updates status to EXCUSED and sets absenceReason', async () => {
      const { recordId } = await service.markAttendance(
        makeDto({ status: 'ABSENT', studentId: 'stu-excuse' }),
      );
      const updated = await service.excuseAbsence(recordId, 'Medical leave');
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('EXCUSED');
      expect(updated!.absenceReason).toBe('Medical leave');
    });

    it('mutation is reflected in the stored record', async () => {
      const { recordId } = await service.markAttendance(
        makeDto({ status: 'ABSENT', studentId: 'stu-excuse-stored' }),
      );
      await service.excuseAbsence(recordId, 'Family emergency');
      const records: any[] = (service as any).records;
      const rec = records.find((r: any) => r.id === recordId);
      expect(rec.status).toBe('EXCUSED');
      expect(rec.absenceReason).toBe('Family emergency');
    });

    it('returns null for an unknown recordId', async () => {
      const result = await service.excuseAbsence('non-existent-id', 'Any reason');
      expect(result).toBeNull();
    });

    it('can excuse a PRESENT record (no guard on prior status)', async () => {
      const { recordId } = await service.markAttendance(
        makeDto({ status: 'PRESENT', studentId: 'stu-excuse-present' }),
      );
      const updated = await service.excuseAbsence(recordId, 'Retroactive');
      expect(updated!.status).toBe('EXCUSED');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getStudentSummary
  // ══════════════════════════════════════════════════════════════════════════

  describe('getStudentSummary', () => {
    it('returns zeroed summary for a student with no records', async () => {
      const summary = await service.getStudentSummary('stu-nobody');
      expect(summary).toMatchObject({ studentId: 'stu-nobody', total: 0, present: 0, absent: 0, percentage: 0 });
    });

    it('calculates percentage correctly for a student', async () => {
      const studentId = 'stu-summary';
      // 3 present, 1 absent → 75%
      await service.markAttendance(makeDto({ studentId, status: 'PRESENT', period: 1 }));
      await service.markAttendance(makeDto({ studentId, status: 'PRESENT', period: 2 }));
      await service.markAttendance(makeDto({ studentId, status: 'PRESENT', period: 3 }));
      await service.markAttendance(makeDto({ studentId, status: 'ABSENT', period: 4 }));

      const summary = await service.getStudentSummary(studentId);
      expect(summary.total).toBe(4);
      expect(summary.present).toBe(3);
      expect(summary.absent).toBe(1);
      expect(summary.percentage).toBe(75);
    });

    it('100% present → percentage is 100', async () => {
      const studentId = 'stu-100pct';
      await service.markAttendance(makeDto({ studentId, status: 'PRESENT', period: 1 }));
      await service.markAttendance(makeDto({ studentId, status: 'PRESENT', period: 2 }));
      const summary = await service.getStudentSummary(studentId);
      expect(summary.percentage).toBe(100);
    });

    it('0% present → percentage is 0', async () => {
      const studentId = 'stu-0pct';
      await service.markAttendance(makeDto({ studentId, status: 'ABSENT', period: 1 }));
      await service.markAttendance(makeDto({ studentId, status: 'ABSENT', period: 2 }));
      const summary = await service.getStudentSummary(studentId);
      expect(summary.percentage).toBe(0);
    });

    it('does not include other students records', async () => {
      await service.markAttendance(makeDto({ studentId: 'stu-other', status: 'PRESENT' }));
      const summary = await service.getStudentSummary('stu-isolated');
      expect(summary.total).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getClassSummary
  // ══════════════════════════════════════════════════════════════════════════

  describe('getClassSummary', () => {
    it('returns zeroed summary for an empty class', async () => {
      const summary = await service.getClassSummary('cls-empty');
      expect(summary).toMatchObject({ classId: 'cls-empty', total: 0, present: 0, absent: 0, late: 0, pct: 0 });
    });

    it('calculates pct based on present/total', async () => {
      // 2 present, 1 absent, 1 late → present=2, total=4, pct=50
      const classId = 'cls-summary';
      await service.markAttendance(makeDto({ classId, studentId: 'sA', status: 'PRESENT', period: 1 }));
      await service.markAttendance(makeDto({ classId, studentId: 'sB', status: 'PRESENT', period: 1 }));
      await service.markAttendance(makeDto({ classId, studentId: 'sC', status: 'ABSENT', period: 1 }));
      await service.markAttendance(makeDto({ classId, studentId: 'sD', status: 'LATE', period: 1 }));

      const summary = await service.getClassSummary(classId);
      expect(summary.total).toBe(4);
      expect(summary.present).toBe(2);
      expect(summary.absent).toBe(1);
      expect(summary.late).toBe(1);
      expect(summary.pct).toBe(50);
    });

    it('counts only records for the specified classId', async () => {
      await service.markAttendance(makeDto({ classId: 'cls-other', studentId: 'sX', status: 'PRESENT' }));
      const summary = await service.getClassSummary('cls-isolated');
      expect(summary.total).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getClassToday / getAbsenteesToday
  // ══════════════════════════════════════════════════════════════════════════

  describe('getClassToday', () => {
    it('returns only records for today', async () => {
      const classId = 'cls-today-test';
      await service.markAttendance(makeDto({ classId, studentId: 'sT1', date: TODAY, status: 'PRESENT' }));
      // Manually inject a past-dated record to ensure it is excluded
      (service as any).records.push({
        id: 'past-rec',
        studentId: 'sT2',
        institutionId: 'default',
        classId,
        subjectId: 'sub-X',
        date: daysAgo(1),
        period: 1,
        markedAt: new Date(),
        status: 'PRESENT',
        markedBy: 'teacher-001',
        source: 'MANUAL',
        callTriggered: false,
        createdAt: new Date(),
      });
      const records = await service.getClassToday(classId);
      expect(records.length).toBe(1);
      expect(records[0]!.studentId).toBe('sT1');
    });

    it('returns empty array if no records today', async () => {
      const records = await service.getClassToday('cls-no-today');
      expect(records).toEqual([]);
    });
  });

  describe('getAbsenteesToday', () => {
    it('returns only absent records for today', async () => {
      const classId = 'cls-absentees';
      await service.markAttendance(makeDto({ classId, studentId: 'sAbs1', date: TODAY, status: 'ABSENT' }));
      await service.markAttendance(makeDto({ classId, studentId: 'sAbs2', date: TODAY, status: 'PRESENT' }));
      await service.markAttendance(makeDto({ classId, studentId: 'sAbs3', date: TODAY, status: 'ABSENT' }));

      const absentees = await service.getAbsenteesToday(classId);
      expect(absentees.length).toBe(2);
      const ids = absentees.map((r) => r.studentId);
      expect(ids).toContain('sAbs1');
      expect(ids).toContain('sAbs3');
      expect(ids).not.toContain('sAbs2');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // updateAbsenceReason
  // ══════════════════════════════════════════════════════════════════════════

  describe('updateAbsenceReason', () => {
    it('sets absenceReason on the matching ABSENT record', async () => {
      const studentId = 'stu-update-reason';
      await service.markAttendance(makeDto({ studentId, status: 'ABSENT', date: TODAY }));
      await service.updateAbsenceReason(studentId, TODAY, 'Fever');
      const records: any[] = (service as any).records;
      const rec = records.find(
        (r: any) => r.studentId === studentId && r.date === TODAY && r.status === 'ABSENT',
      );
      expect(rec.absenceReason).toBe('Fever');
    });

    it('does not mutate records that do not match', async () => {
      const studentId = 'stu-no-match';
      await service.markAttendance(makeDto({ studentId, status: 'PRESENT', date: TODAY }));
      await service.updateAbsenceReason(studentId, TODAY, 'Should not appear');
      const records: any[] = (service as any).records;
      const rec = records.find((r: any) => r.studentId === studentId);
      expect(rec.absenceReason).toBeUndefined();
    });

    it('silently handles a studentId with no records', async () => {
      await expect(
        service.updateAbsenceReason('ghost-student', TODAY, 'Reason'),
      ).resolves.toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getAtRisk
  // ══════════════════════════════════════════════════════════════════════════

  describe('getAtRisk', () => {
    it('returns empty array when no one is absent', async () => {
      await service.markAttendance(makeDto({ studentId: 'stu-allpresent', status: 'PRESENT' }));
      const result = await service.getAtRisk();
      expect(result.find((r) => r.studentId === 'stu-allpresent')).toBeUndefined();
    });

    it('does NOT flag a student with < 3 absences in 7 days', async () => {
      const studentId = 'stu-2-absences';
      for (let i = 0; i < 2; i++) {
        (service as any).records.push({
          id: `rec-${i}`,
          studentId,
          institutionId: 'default',
          classId: 'cls-X',
          subjectId: 'sub-X',
          date: daysAgo(i),
          period: 1,
          markedAt: new Date(),
          status: 'ABSENT',
          markedBy: 'teacher-001',
          source: 'MANUAL',
          callTriggered: true,
          createdAt: new Date(),
        });
      }
      const result = await service.getAtRisk();
      expect(result.find((r) => r.studentId === studentId)).toBeUndefined();
    });

    it('flags a student with exactly 3 absences in the rolling 7-day window', async () => {
      const studentId = 'stu-3-absences';
      for (let i = 0; i < 3; i++) {
        (service as any).records.push({
          id: `rec3-${i}`,
          studentId,
          institutionId: 'default',
          classId: 'cls-X',
          subjectId: 'sub-X',
          date: daysAgo(i),
          period: 1,
          markedAt: new Date(),
          status: 'ABSENT',
          markedBy: 'teacher-001',
          source: 'MANUAL',
          callTriggered: true,
          createdAt: new Date(),
        });
      }
      const result = await service.getAtRisk();
      const entry = result.find((r) => r.studentId === studentId);
      expect(entry).toBeDefined();
      expect(entry!.absenceCount).toBe(3);
    });

    it('does not count absences older than 7 days', async () => {
      const studentId = 'stu-old-absences';
      for (let i = 0; i < 5; i++) {
        (service as any).records.push({
          id: `rec-old-${i}`,
          studentId,
          institutionId: 'default',
          classId: 'cls-X',
          subjectId: 'sub-X',
          date: daysAgo(8 + i), // all older than 7 days
          period: 1,
          markedAt: new Date(),
          status: 'ABSENT',
          markedBy: 'teacher-001',
          source: 'MANUAL',
          callTriggered: true,
          createdAt: new Date(),
        });
      }
      const result = await service.getAtRisk();
      expect(result.find((r) => r.studentId === studentId)).toBeUndefined();
    });

    it('results are sorted by absenceCount descending', async () => {
      const push = (studentId: string, count: number) => {
        for (let i = 0; i < count; i++) {
          (service as any).records.push({
            id: `sort-${studentId}-${i}`,
            studentId,
            institutionId: 'default',
            classId: 'cls-sort',
            subjectId: 'sub-sort',
            date: daysAgo(i),
            period: 1,
            markedAt: new Date(),
            status: 'ABSENT',
            markedBy: 'teacher-sort',
            source: 'MANUAL',
            callTriggered: true,
            createdAt: new Date(),
          });
        }
      };
      push('stu-sort-A', 5);
      push('stu-sort-B', 3);
      push('stu-sort-C', 4);
      const result = await service.getAtRisk();
      const relevant = result.filter((r) => r.studentId.startsWith('stu-sort-'));
      const counts = relevant.map((r) => r.absenceCount);
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i - 1]!).toBeGreaterThanOrEqual(counts[i]!);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getClassAtRisk  (below 75% in a specific class)
  // ══════════════════════════════════════════════════════════════════════════

  describe('getClassAtRisk', () => {
    it('returns empty array when all students are above 75%', async () => {
      const classId = 'cls-all-safe';
      // 4 present, 0 absent → 100%
      for (let i = 0; i < 4; i++) {
        await service.markAttendance(
          makeDto({ classId, studentId: `stu-safe-${i}`, status: 'PRESENT', period: i + 1 }),
        );
      }
      const result = await service.getClassAtRisk(classId);
      expect(result).toHaveLength(0);
    });

    it('flags a student whose present% is below 75', async () => {
      const classId = 'cls-below75';
      const studentId = 'stu-risky';
      // 1 present, 3 absent → 25% present → at risk
      await service.markAttendance(makeDto({ classId, studentId, status: 'PRESENT', period: 1 }));
      await service.markAttendance(makeDto({ classId, studentId, status: 'ABSENT', period: 2 }));
      await service.markAttendance(makeDto({ classId, studentId, status: 'ABSENT', period: 3 }));
      await service.markAttendance(makeDto({ classId, studentId, status: 'ABSENT', period: 4 }));

      const result = await service.getClassAtRisk(classId);
      const entry = result.find((r) => r.studentId === studentId);
      expect(entry).toBeDefined();
      expect(entry!.absencePct).toBe(75); // Math.round(3/4*100)
    });

    it('does NOT flag a student at exactly 75% present', async () => {
      /**
       * The implementation checks: `if (100 - pct < 75)` where pct = absent%.
       * Present 75% → absent 25% → 100 - 25 = 75, which is NOT < 75 → safe.
       */
      const classId = 'cls-exactly75';
      const studentId = 'stu-exactly75';
      // 3 present, 1 absent → 75% present → NOT at risk
      for (let i = 0; i < 3; i++) {
        await service.markAttendance(makeDto({ classId, studentId, status: 'PRESENT', period: i + 1 }));
      }
      await service.markAttendance(makeDto({ classId, studentId, status: 'ABSENT', period: 4 }));

      const result = await service.getClassAtRisk(classId);
      expect(result.find((r) => r.studentId === studentId)).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // VTU Eligibility  ← HIGHEST PRIORITY (academic / legal risk)
  // ══════════════════════════════════════════════════════════════════════════

  describe('getVtuEligibility', () => {
    /**
     * Helper: seed N attended and M absent records for a student in a subject.
     * LATE is counted as attended per the service implementation.
     */
    async function seedVtu(
      studentUsn: string,
      subjectId: string,
      attended: number,
      absent: number,
    ): Promise<void> {
      for (let i = 0; i < attended; i++) {
        await service.markAttendance({
          studentId: studentUsn,
          classId: 'cls-VTU',
          subjectId,
          date: daysAgo(i),
          period: i + 1,
          status: 'PRESENT',
          markedBy: 'teacher-vtu',
        });
      }
      for (let i = 0; i < absent; i++) {
        await service.markAttendance({
          studentId: studentUsn,
          classId: 'cls-VTU',
          subjectId,
          date: daysAgo(attended + i),
          period: attended + i + 1,
          status: 'ABSENT',
          markedBy: 'teacher-vtu',
        });
      }
    }

    it('exactly 75.00% → ELIGIBLE', async () => {
      // 3 attended, 1 absent → 75%
      await seedVtu('usn-75', 'sub-VTU-A', 3, 1);
      const result = await service.getVtuEligibility('usn-75');
      const sub = result.find((r) => r.subjectId === 'sub-VTU-A');
      expect(sub).toBeDefined();
      expect(sub!.pct).toBe(75);
      expect(sub!.eligible).toBe(true);
    });

    it('74.99% (just below 75%) → NOT ELIGIBLE', async () => {
      /**
       * We cannot get exactly 74.99 with integers since pct is Math.round'd.
       * Use 2 attended / 3 total = 66.67% → rounds to 67 → not eligible.
       * Also verify: 14 attended / 19 total = 73.68% → rounds to 74 → not eligible.
       * This covers the boundary below 75.
       */
      await seedVtu('usn-74', 'sub-VTU-B', 14, 5); // 14/19 = 73.68 → 74%
      const result = await service.getVtuEligibility('usn-74');
      const sub = result.find((r) => r.subjectId === 'sub-VTU-B');
      expect(sub).toBeDefined();
      expect(sub!.pct).toBe(74);
      expect(sub!.eligible).toBe(false);
    });

    it('pct rounds 74.5 → 75 → boundary is ELIGIBLE', async () => {
      /**
       * 149/199 total: 149/199 = 74.87% → Math.round → 75 → ELIGIBLE.
       * Simpler set: use 3 present, 1 absent in LATE to stay within seeding.
       * Actually use direct record injection for a precise fractional case.
       * 149 attended, 50 absent: 149/199 = 74.87 → round to 75.
       */
      const studentUsn = 'usn-round-up';
      const subjectId = 'sub-VTU-ROUND';
      // Inject 149 present + 50 absent = 199 total
      for (let i = 0; i < 149; i++) {
        (service as any).records.push({
          id: `vtu-p-${i}`,
          studentId: studentUsn,
          institutionId: 'default',
          classId: 'cls-VTU',
          subjectId,
          date: daysAgo(i % 30),
          period: (i % 8) + 1,
          markedAt: new Date(),
          status: 'PRESENT',
          markedBy: 'teacher-vtu',
          source: 'MANUAL',
          callTriggered: false,
          createdAt: new Date(),
        });
      }
      for (let i = 0; i < 50; i++) {
        (service as any).records.push({
          id: `vtu-a-${i}`,
          studentId: studentUsn,
          institutionId: 'default',
          classId: 'cls-VTU',
          subjectId,
          date: daysAgo(i % 30),
          period: (i % 8) + 1,
          markedAt: new Date(),
          status: 'ABSENT',
          markedBy: 'teacher-vtu',
          source: 'MANUAL',
          callTriggered: true,
          createdAt: new Date(),
        });
      }
      const result = await service.getVtuEligibility(studentUsn);
      const sub = result.find((r) => r.subjectId === subjectId);
      expect(sub).toBeDefined();
      // 149/199 = 74.87 → rounds to 75 → eligible
      expect(sub!.pct).toBe(75);
      expect(sub!.eligible).toBe(true);
    });

    it('100% attended → ELIGIBLE with canMissMore > 0', async () => {
      await seedVtu('usn-100', 'sub-VTU-C', 4, 0);
      const result = await service.getVtuEligibility('usn-100');
      const sub = result.find((r) => r.subjectId === 'sub-VTU-C');
      expect(sub).toBeDefined();
      expect(sub!.pct).toBe(100);
      expect(sub!.eligible).toBe(true);
      // With 4/4: canMissMore = Math.floor(4 - 0.75*4) = Math.floor(4-3) = 1
      expect(sub!.canMissMore).toBe(1);
      expect(sub!.mustAttend).toBe(0);
    });

    it('0% attended → NOT ELIGIBLE, mustAttend > 0', async () => {
      await seedVtu('usn-0pct', 'sub-VTU-D', 0, 4);
      const result = await service.getVtuEligibility('usn-0pct');
      const sub = result.find((r) => r.subjectId === 'sub-VTU-D');
      expect(sub).toBeDefined();
      expect(sub!.pct).toBe(0);
      expect(sub!.eligible).toBe(false);
      // mustAttend = Math.ceil(0.75 * 4 - 0) = Math.ceil(3) = 3
      expect(sub!.mustAttend).toBe(3);
      expect(sub!.canMissMore).toBe(0);
    });

    it('0 total classes → no division by zero, returns empty array', async () => {
      const result = await service.getVtuEligibility('usn-no-records');
      expect(result).toEqual([]);
    });

    it('LATE status counts as attended for VTU eligibility', async () => {
      const studentUsn = 'usn-late';
      const subjectId = 'sub-VTU-LATE';
      // 3 LATE + 1 ABSENT = 4 total, 3 attended → 75%
      for (let i = 0; i < 3; i++) {
        await service.markAttendance({
          studentId: studentUsn,
          classId: 'cls-VTU',
          subjectId,
          date: daysAgo(i),
          period: i + 1,
          status: 'LATE',
          markedBy: 'teacher-vtu',
        });
      }
      await service.markAttendance({
        studentId: studentUsn,
        classId: 'cls-VTU',
        subjectId,
        date: daysAgo(3),
        period: 4,
        status: 'ABSENT',
        markedBy: 'teacher-vtu',
      });
      const result = await service.getVtuEligibility(studentUsn);
      const sub = result.find((r) => r.subjectId === subjectId);
      expect(sub).toBeDefined();
      expect(sub!.attended).toBe(3);
      expect(sub!.eligible).toBe(true);
    });

    it('EXCUSED status does NOT count as attended', async () => {
      const studentUsn = 'usn-excused';
      const subjectId = 'sub-VTU-EXCUSED';
      // 1 PRESENT + 3 EXCUSED = 4 total, only 1 attended → 25% → not eligible
      await service.markAttendance({
        studentId: studentUsn,
        classId: 'cls-VTU',
        subjectId,
        date: daysAgo(0),
        period: 1,
        status: 'PRESENT',
        markedBy: 'teacher-vtu',
      });
      for (let i = 1; i <= 3; i++) {
        (service as any).records.push({
          id: `exc-${i}`,
          studentId: studentUsn,
          institutionId: 'default',
          classId: 'cls-VTU',
          subjectId,
          date: daysAgo(i),
          period: i + 1,
          markedAt: new Date(),
          status: 'EXCUSED',
          markedBy: 'teacher-vtu',
          source: 'MANUAL',
          callTriggered: false,
          createdAt: new Date(),
        });
      }
      const result = await service.getVtuEligibility(studentUsn);
      const sub = result.find((r) => r.subjectId === subjectId);
      expect(sub).toBeDefined();
      expect(sub!.attended).toBe(1);
      expect(sub!.eligible).toBe(false);
    });

    it('multiple subjects returned as separate entries', async () => {
      const studentUsn = 'usn-multi-subject';
      await seedVtu(studentUsn, 'sub-MATH', 4, 0);
      await seedVtu(studentUsn, 'sub-PHY', 2, 2);
      const result = await service.getVtuEligibility(studentUsn);
      const math = result.find((r) => r.subjectId === 'sub-MATH');
      const phy = result.find((r) => r.subjectId === 'sub-PHY');
      expect(math).toBeDefined();
      expect(phy).toBeDefined();
      expect(math!.eligible).toBe(true);
      expect(phy!.eligible).toBe(false);
    });

    it('canMissMore is 0 when student is not eligible', async () => {
      await seedVtu('usn-cant-miss', 'sub-VTU-E', 2, 2); // 50% → not eligible
      const result = await service.getVtuEligibility('usn-cant-miss');
      const sub = result.find((r) => r.subjectId === 'sub-VTU-E');
      expect(sub!.canMissMore).toBe(0);
    });

    it('mustAttend is 0 when student is eligible', async () => {
      await seedVtu('usn-no-must', 'sub-VTU-F', 4, 0); // 100% → eligible
      const result = await service.getVtuEligibility('usn-no-must');
      const sub = result.find((r) => r.subjectId === 'sub-VTU-F');
      expect(sub!.mustAttend).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // runEscalationEngine
  // ══════════════════════════════════════════════════════════════════════════

  describe('runEscalationEngine', () => {
    /**
     * Inject exactly N absences in the 7-day window for a student.
     */
    function injectAbsences(studentId: string, count: number): void {
      for (let i = 0; i < count; i++) {
        (service as any).records.push({
          id: `esc-${studentId}-${i}`,
          studentId,
          institutionId: 'default',
          classId: 'cls-esc',
          subjectId: 'sub-esc',
          date: daysAgo(i % 7), // within rolling window
          period: (i % 8) + 1,
          markedAt: new Date(),
          status: 'ABSENT',
          markedBy: 'teacher-esc',
          source: 'MANUAL',
          callTriggered: true,
          createdAt: new Date(),
        });
      }
    }

    it('resolves without error even when there are no at-risk students', async () => {
      await expect(service.runEscalationEngine()).resolves.toBeUndefined();
      const escalations: any[] = (service as any).escalations;
      expect(escalations.length).toBe(0);
    });

    it('3 absences → creates a DAY3 / CALL escalation', async () => {
      injectAbsences('stu-day3', 3);
      await service.runEscalationEngine();
      const escalations: any[] = (service as any).escalations;
      const esc = escalations.find(
        (e: any) => e.studentId === 'stu-day3' && e.escalationLevel === 'DAY3',
      );
      expect(esc).toBeDefined();
      expect(esc.actionTaken).toBe('CALL');
    });

    it('5 absences → creates a DAY5 / WHATSAPP_EMAIL escalation (not DAY3)', async () => {
      injectAbsences('stu-day5', 5);
      await service.runEscalationEngine();
      const escalations: any[] = (service as any).escalations;
      const day5 = escalations.find(
        (e: any) => e.studentId === 'stu-day5' && e.escalationLevel === 'DAY5',
      );
      const day3 = escalations.find(
        (e: any) => e.studentId === 'stu-day5' && e.escalationLevel === 'DAY3',
      );
      expect(day5).toBeDefined();
      expect(day5.actionTaken).toBe('WHATSAPP_EMAIL');
      expect(day3).toBeUndefined(); // engine escalates to highest applicable level only
    });

    it('7 absences → DAY7 / TEACHER_ALERT', async () => {
      injectAbsences('stu-day7', 7);
      await service.runEscalationEngine();
      const escalations: any[] = (service as any).escalations;
      const esc = escalations.find(
        (e: any) => e.studentId === 'stu-day7' && e.escalationLevel === 'DAY7',
      );
      expect(esc).toBeDefined();
      expect(esc.actionTaken).toBe('TEACHER_ALERT');
    });

    it('10 absences → DAY10 / PTM_SCHEDULED', async () => {
      injectAbsences('stu-day10', 10);
      await service.runEscalationEngine();
      const escalations: any[] = (service as any).escalations;
      const esc = escalations.find(
        (e: any) => e.studentId === 'stu-day10' && e.escalationLevel === 'DAY10',
      );
      expect(esc).toBeDefined();
      expect(esc.actionTaken).toBe('PTM_SCHEDULED');
    });

    it('running engine twice does NOT create duplicate DAY3 escalation', async () => {
      injectAbsences('stu-dup-esc', 3);
      await service.runEscalationEngine();
      await service.runEscalationEngine(); // second run
      const escalations: any[] = (service as any).escalations;
      const matches = escalations.filter(
        (e: any) => e.studentId === 'stu-dup-esc' && e.escalationLevel === 'DAY3',
      );
      expect(matches.length).toBe(1); // exactly one, not two
    });

    it('escalation record contains required fields', async () => {
      injectAbsences('stu-fields', 3);
      await service.runEscalationEngine();
      const escalations: any[] = (service as any).escalations;
      const esc = escalations.find((e: any) => e.studentId === 'stu-fields');
      expect(esc).toBeDefined();
      expect(esc.id).toBeDefined();
      expect(esc.windowStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(esc.windowEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(esc.absenceCount).toBe(3);
      expect(esc.institutionId).toBe('default');
      expect(esc.triggeredAt).toBeInstanceOf(Date);
    });

    it('student with exactly 2 absences (below threshold) gets NO escalation', async () => {
      injectAbsences('stu-below-threshold', 2);
      await service.runEscalationEngine();
      const escalations: any[] = (service as any).escalations;
      const esc = escalations.find(
        (e: any) => e.studentId === 'stu-below-threshold',
      );
      expect(esc).toBeUndefined();
    });

    it('student who was at-risk but absences dropped below 3 gets no new escalation', async () => {
      /**
       * Simulate: student had DAY3 previously → later absences move outside
       * the 7-day window → getAtRisk returns nothing → no new escalation.
       */
      const studentId = 'stu-recovered';
      // Inject absences OUTSIDE the 7-day window (older than 7 days)
      for (let i = 0; i < 5; i++) {
        (service as any).records.push({
          id: `old-${i}`,
          studentId,
          institutionId: 'default',
          classId: 'cls-esc',
          subjectId: 'sub-esc',
          date: daysAgo(8 + i),
          period: i + 1,
          markedAt: new Date(),
          status: 'ABSENT',
          markedBy: 'teacher-esc',
          source: 'MANUAL',
          callTriggered: true,
          createdAt: new Date(),
        });
      }
      await service.runEscalationEngine();
      const escalations: any[] = (service as any).escalations;
      expect(escalations.find((e: any) => e.studentId === studentId)).toBeUndefined();
    });
  });
});
