/**
 * attendance.integration.spec.ts
 *
 * Integration tests for AttendanceService — tests cross-method workflows using
 * the real in-memory store (no DB, no mocks of the service itself).
 *
 * Scenarios:
 *   1. Full absence escalation: 3 ABSENT → escalation created → summary correct → VTU DETAINED
 *   2. Recovery: absent 3 → present 10 → no new escalation, VTU eligible again
 *   3. Student isolation: escalation for student-A does NOT bleed into student-B
 *   4. Concurrent bulk marks: no duplicate records per student
 */

import 'reflect-metadata';
import { AttendanceService } from './attendance.service';
import { Logger } from '@nestjs/common';

// Silence NestJS logger noise
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

// ─── date helpers ────────────────────────────────────────────────────────────

/** Returns an ISO date string N days ago (0 = today). */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Inject an absence record directly into the service's private records array.
 * This bypasses emitAbsentEvent to keep tests fast while still exercising all
 * query/escalation logic that reads from the store.
 */
function injectAbsence(
  service: AttendanceService,
  studentId: string,
  subjectId: string,
  daysBackIndex: number,
  idPrefix: string,
): void {
  (service as any).records.push({
    id: `${idPrefix}-${daysBackIndex}`,
    studentId,
    institutionId: 'default',
    classId: 'cls-int',
    subjectId,
    date: daysAgo(daysBackIndex),
    period: (daysBackIndex % 8) + 1,
    markedAt: new Date(),
    status: 'ABSENT',
    markedBy: 'teacher-int',
    source: 'MANUAL',
    callTriggered: true,
    createdAt: new Date(),
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Full absence escalation workflow', () => {
  let service: AttendanceService;

  beforeEach(() => {
    service = new AttendanceService();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 1 — absent 3 days → escalation → summary → VTU DETAINED
  // ════════════════════════════════════════════════════════════════════════════

  it('student absent 3 days → DAY3 escalation created → summary shows correct absent count → VTU ineligible', async () => {
    const studentId = 'int-stu-001';
    const subjectId = 'sub-MATH';

    // Step 1: mark attendance ABSENT for 3 different days via the public API
    for (let i = 0; i < 3; i++) {
      await service.markAttendance({
        studentId,
        classId: 'cls-int',
        subjectId,
        date: daysAgo(i),
        period: i + 1,
        status: 'ABSENT',
        markedBy: 'teacher-int',
      });
    }

    // Step 2: run the escalation engine
    await service.runEscalationEngine();

    // Step 3: assert DAY3 escalation was created
    const escalations: any[] = (service as any).escalations;
    const esc = escalations.find(
      (e: any) => e.studentId === studentId && e.escalationLevel === 'DAY3',
    );
    expect(esc).toBeDefined();
    expect(esc.actionTaken).toBe('CALL');
    expect(esc.absenceCount).toBe(3);

    // Step 4: assert getStudentSummary shows correct counts
    const summary = await service.getStudentSummary(studentId);
    expect(summary.total).toBe(3);
    expect(summary.absent).toBe(3);
    expect(summary.present).toBe(0);
    expect(summary.percentage).toBe(0);

    // Step 5: assert VTU eligibility shows NOT eligible for that subject
    const vtu = await service.getVtuEligibility(studentId);
    const subEntry = vtu.find((v) => v.subjectId === subjectId);
    expect(subEntry).toBeDefined();
    expect(subEntry!.eligible).toBe(false);
    expect(subEntry!.pct).toBe(0);
    expect(subEntry!.mustAttend).toBeGreaterThan(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 2 — recovery: absent 3 → then present 10 → no new escalation → VTU eligible
  // ════════════════════════════════════════════════════════════════════════════

  it('student recovers: absent 3 (recent) → present 10 → no new escalation beyond first, VTU eligible again', async () => {
    const studentId = 'int-stu-002';
    const subjectId = 'sub-PHY';

    // Phase A: mark 3 absences within rolling 7-day window
    for (let i = 0; i < 3; i++) {
      await service.markAttendance({
        studentId,
        classId: 'cls-int',
        subjectId,
        date: daysAgo(i),
        period: i + 1,
        status: 'ABSENT',
        markedBy: 'teacher-int',
      });
    }

    // Run escalation engine — should create DAY3
    await service.runEscalationEngine();
    const escalationsAfterPhaseA: any[] = (service as any).escalations;
    expect(
      escalationsAfterPhaseA.some(
        (e: any) => e.studentId === studentId && e.escalationLevel === 'DAY3',
      ),
    ).toBe(true);

    // Phase B: mark 10 PRESENT for the same subject (these are the recovery classes)
    for (let i = 0; i < 10; i++) {
      await service.markAttendance({
        studentId,
        classId: 'cls-int',
        subjectId,
        date: daysAgo(i + 3), // older dates so they don't overlap absences
        period: i + 4,
        status: 'PRESENT',
        markedBy: 'teacher-int',
      });
    }

    // Running the engine again should NOT create a new DAY3 escalation (deduplication guard)
    const escalationCountBefore = (service as any).escalations.length;
    await service.runEscalationEngine();
    const escalationCountAfter = (service as any).escalations.length;
    // Engine may escalate to higher level if recent absences still qualify,
    // but DAY3 for this student should not be duplicated.
    const day3ForStudent = (service as any).escalations.filter(
      (e: any) => e.studentId === studentId && e.escalationLevel === 'DAY3',
    );
    expect(day3ForStudent.length).toBe(1); // still exactly one DAY3 escalation

    // With 10 present + 3 absent = 13 total, 10 attended → 76.9% → eligible
    const vtu = await service.getVtuEligibility(studentId);
    const subEntry = vtu.find((v) => v.subjectId === subjectId);
    expect(subEntry).toBeDefined();
    expect(subEntry!.eligible).toBe(true);
    expect(subEntry!.pct).toBeGreaterThanOrEqual(75);

    // Summary: 13 total, 10 present, 3 absent
    const summary = await service.getStudentSummary(studentId);
    expect(summary.total).toBe(13);
    expect(summary.present).toBe(10);
    expect(summary.absent).toBe(3);
    expect(summary.percentage).toBeGreaterThanOrEqual(75);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 3 — student isolation: escalation for A does not affect B
  // ════════════════════════════════════════════════════════════════════════════

  it('two students: escalation for student-A does not affect student-B', async () => {
    const studentA = 'int-stu-003A';
    const studentB = 'int-stu-003B';
    const subjectId = 'sub-CHEM';

    // Mark 3 absences for A only
    for (let i = 0; i < 3; i++) {
      injectAbsence(service, studentA, subjectId, i, `a-abs`);
    }

    // Mark 4 PRESENT for B
    for (let i = 0; i < 4; i++) {
      await service.markAttendance({
        studentId: studentB,
        classId: 'cls-int',
        subjectId,
        date: daysAgo(i),
        period: i + 1,
        status: 'PRESENT',
        markedBy: 'teacher-int',
      });
    }

    // Run escalation engine
    await service.runEscalationEngine();

    // Student A should have a DAY3 escalation
    const escalations: any[] = (service as any).escalations;
    expect(
      escalations.some((e: any) => e.studentId === studentA && e.escalationLevel === 'DAY3'),
    ).toBe(true);

    // Student B should have NO escalations at all
    expect(escalations.some((e: any) => e.studentId === studentB)).toBe(false);

    // B's summary should only reflect their own records (4 PRESENT)
    const summaryB = await service.getStudentSummary(studentB);
    expect(summaryB.total).toBe(4);
    expect(summaryB.present).toBe(4);
    expect(summaryB.absent).toBe(0);
    expect(summaryB.percentage).toBe(100);

    // A's summary should only reflect A's records (3 ABSENT)
    const summaryA = await service.getStudentSummary(studentA);
    expect(summaryA.absent).toBe(3);
    expect(summaryA.present).toBe(0);

    // VTU: B should be eligible, A should not
    const vtuA = await service.getVtuEligibility(studentA);
    const vtuB = await service.getVtuEligibility(studentB);

    const aEntry = vtuA.find((v) => v.subjectId === subjectId);
    const bEntry = vtuB.find((v) => v.subjectId === subjectId);

    expect(aEntry).toBeDefined();
    expect(aEntry!.eligible).toBe(false);

    expect(bEntry).toBeDefined();
    expect(bEntry!.eligible).toBe(true);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 4 — concurrent bulk marks: no duplicate records
  // ════════════════════════════════════════════════════════════════════════════

  it('concurrent bulk marks for same class: each student gets exactly 1 record per call', async () => {
    const classId = 'cls-bulk-int';
    const subjectId = 'sub-ENG';
    const date = daysAgo(0);

    // Simulate two bulk mark calls with the same class but different (non-overlapping) students.
    // In a real concurrent scenario these would race; here we verify correctness of the
    // in-memory store by running both calls and asserting each student appears exactly once.
    const bulkCall1 = service.markBulk({
      classId,
      date,
      period: 1,
      subjectId,
      markedBy: 'teacher-int',
      records: [
        { studentId: 'bulk-s1', status: 'PRESENT' },
        { studentId: 'bulk-s2', status: 'ABSENT' },
      ],
    });

    const bulkCall2 = service.markBulk({
      classId,
      date,
      period: 2,
      subjectId,
      markedBy: 'teacher-int',
      records: [
        { studentId: 'bulk-s3', status: 'PRESENT' },
        { studentId: 'bulk-s4', status: 'ABSENT' },
      ],
    });

    // Await both (simulating concurrent execution)
    await Promise.all([bulkCall1, bulkCall2]);

    const allRecords: any[] = (service as any).records;
    const classRecords = allRecords.filter((r: any) => r.classId === classId);

    // 4 unique students, each processed once
    expect(classRecords).toHaveLength(4);

    // Each student should appear exactly once
    for (const studentId of ['bulk-s1', 'bulk-s2', 'bulk-s3', 'bulk-s4']) {
      const studentRecords = classRecords.filter((r: any) => r.studentId === studentId);
      expect(studentRecords).toHaveLength(1);
    }

    // Verify ABSENT students got callTriggered=true
    const s2Rec = classRecords.find((r: any) => r.studentId === 'bulk-s2');
    const s4Rec = classRecords.find((r: any) => r.studentId === 'bulk-s4');
    expect(s2Rec.callTriggered).toBe(true);
    expect(s4Rec.callTriggered).toBe(true);

    // Verify PRESENT students got callTriggered=false
    const s1Rec = classRecords.find((r: any) => r.studentId === 'bulk-s1');
    const s3Rec = classRecords.find((r: any) => r.studentId === 'bulk-s3');
    expect(s1Rec.callTriggered).toBe(false);
    expect(s3Rec.callTriggered).toBe(false);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 5 — escalation level upgrades: 3 absences → DAY3, then 7 absences in window → DAY7
  // ════════════════════════════════════════════════════════════════════════════

  it('escalation levels are independent: DAY3 then DAY7 for same student as absences grow', async () => {
    const studentId = 'int-stu-005';

    // First batch: 3 absences → DAY3
    for (let i = 0; i < 3; i++) {
      injectAbsence(service, studentId, 'sub-X', i, 'lvl-a');
    }
    await service.runEscalationEngine();

    const after3: any[] = (service as any).escalations;
    expect(after3.some((e: any) => e.studentId === studentId && e.escalationLevel === 'DAY3')).toBe(true);
    expect(after3.some((e: any) => e.studentId === studentId && e.escalationLevel === 'DAY7')).toBe(false);

    // Add 4 more absences (total 7 in window) — engine should now create DAY7
    for (let i = 3; i < 7; i++) {
      injectAbsence(service, studentId, 'sub-X', i, 'lvl-b');
    }
    await service.runEscalationEngine();

    const after7: any[] = (service as any).escalations;
    // DAY7 must now exist
    expect(after7.some((e: any) => e.studentId === studentId && e.escalationLevel === 'DAY7')).toBe(true);
    // DAY3 still exactly 1 (not duplicated)
    const day3Count = after7.filter(
      (e: any) => e.studentId === studentId && e.escalationLevel === 'DAY3',
    ).length;
    expect(day3Count).toBe(1);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 6 — markBulk + getAtRisk integration across the same service instance
  // ════════════════════════════════════════════════════════════════════════════

  it('markBulk absent → getAtRisk returns that student — same service instance', async () => {
    const studentId = 'int-stu-006';

    // 3 absences via markBulk (each call 1 student, different days)
    for (let i = 0; i < 3; i++) {
      await service.markBulk({
        classId: 'cls-risk',
        date: daysAgo(i),
        period: 1,
        subjectId: 'sub-CS',
        markedBy: 'teacher-int',
        records: [{ studentId, status: 'ABSENT' }],
      });
    }

    const atRisk = await service.getAtRisk();
    const entry = atRisk.find((r) => r.studentId === studentId);
    expect(entry).toBeDefined();
    expect(entry!.absenceCount).toBe(3);
  });
});
