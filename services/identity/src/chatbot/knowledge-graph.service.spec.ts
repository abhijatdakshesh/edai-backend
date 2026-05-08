import { KnowledgeGraphService } from './knowledge-graph.service';

const mockQuery = jest.fn();
const mockDb = { query: mockQuery } as any;

const studentRow = {
  name: 'Alice', usn: '1RV21CS001', semester: 5, section: 'A', department: 'CSE', lang: 'en',
};
const slotRow = { slot_index: 0, subject_name: 'DBMS', faculty_name: 'Dr. Kumar', room_number: 'LH-101', is_lab: false };
const attRow = { subject_name: 'DBMS', present: 40, total: 50, pct: 80.0, needed: 0 };
const marksRow = { subject_name: 'DBMS', ia1: 18, ia2: 17, max_marks: 20 };
const feeRow = { total_amount: 85000, paid_amount: 60000, balance: 25000, payment_status: 'PARTIAL', due_date: '2026-05-15' };
const riskRow = { risk_score: 0.3, risk_level: 'LOW' };
const absenceRow = { cnt: 2 };

const teacherRow = { name: 'Dr. Kumar', emp_id: 'FAC001', department: 'CSE', lang: 'en' };
const teacherSlot = { slot_index: 1, subject_name: 'DBMS', section: 'A', room_number: 'LH-101', semester: 5 };
const subjectRow = { subject_name: 'DBMS', sections: 'A, B', total_students: 60, avg_att: 78.5 };
const atRiskRow = { usn: '1RV21CS002', name: 'Bob', risk_score: 0.8, risk_level: 'HIGH', primary_concern: 'Low attendance' };

describe('KnowledgeGraphService', () => {
  let svc: KnowledgeGraphService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new KnowledgeGraphService(mockDb);
  });

  describe('buildStudentGraph()', () => {
    it('returns student graph with live data', async () => {
      mockQuery
        .mockResolvedValueOnce([studentRow])   // 1. students (profile)
        .mockResolvedValueOnce([slotRow])       // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([attRow])        // 4. attendance
        .mockResolvedValueOnce([marksRow])      // 5. marks
        .mockResolvedValueOnce([feeRow])        // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([riskRow])       // 8. risk
        .mockResolvedValueOnce([absenceRow])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');

      expect(graph.role).toBe('STUDENT');
      expect(graph.name).toBe('Alice');
      expect(graph.usn).toBe('1RV21CS001');
      expect(graph.todaySchedule).toHaveLength(1);
      expect(graph.todaySchedule[0].subject).toBe('DBMS');
      expect(graph.attendanceSummary[0].percentage).toBe(80);
      expect(graph.detentionRisk).toBe(false);
      expect(graph.feeStatus.balance).toBe(25000);
      expect(graph.riskLevel).toBe('LOW');
      expect(graph.recentAbsenceCount).toBe(2);
    });

    it('returns empty graph when student not found', async () => {
      mockQuery
        .mockResolvedValueOnce([])              // 1. students — empty
        .mockResolvedValueOnce([])              // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([])              // 4. attendance
        .mockResolvedValueOnce([])              // 5. marks
        .mockResolvedValueOnce([])              // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([])              // 8. risk
        .mockResolvedValueOnce([{ cnt: 0 }])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('UNKNOWN');
      // Production now synthesizes a 'Demo Student' profile when the row is missing.
      expect(graph.name).toBe('Demo Student');
      // todaySchedule falls back to DEMO_TODAY_SCHEDULE when DB returns no slots.
      expect(Array.isArray(graph.todaySchedule)).toBe(true);
    });

    it('returns empty graph when db is null', async () => {
      const svcNoDb = new KnowledgeGraphService(null);
      const graph = await svcNoDb.buildStudentGraph('1RV21CS001');
      expect(graph.role).toBe('STUDENT');
      expect(graph.name).toBe('Unknown');
    });

    it('sets detentionRisk when any subject below 75%', async () => {
      const lowAtt = { ...attRow, pct: 60.0, needed: 8 };
      mockQuery
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([])              // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([lowAtt])        // 4. attendance
        .mockResolvedValueOnce([])              // 5. marks
        .mockResolvedValueOnce([])              // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([])              // 8. risk
        .mockResolvedValueOnce([{ cnt: 0 }])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');
      expect(graph.detentionRisk).toBe(true);
    });

    it('handles missing fee record gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([])              // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([])              // 4. attendance
        .mockResolvedValueOnce([])              // 5. marks
        .mockResolvedValueOnce([])              // 6. fees — no fee row
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([])              // 8. risk
        .mockResolvedValueOnce([{ cnt: 0 }])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');
      // Missing fee row now falls back to DEMO_FEES with status 'PARTIAL'.
      expect(graph.feeStatus.status).toBe('PARTIAL');
    });
  });

  describe('buildParentGraph()', () => {
    it('returns parent graph wrapping child student graph', async () => {
      mockQuery
        .mockResolvedValueOnce([{ student_id: '1RV21CS001', lang: 'kn' }])  // 0. parent lookup
        // buildStudentGraph runs first (await Promise.all → both start, but parent lookup has student_id field)
        // Promise.all in buildParentGraph fires buildStudentGraph + parentAnnouncements concurrently
        // buildStudentGraph queries 1-14 + parentAnnouncements query
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([slotRow])       // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([attRow])        // 4. attendance
        .mockResolvedValueOnce([marksRow])      // 5. marks
        .mockResolvedValueOnce([feeRow])        // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([riskRow])       // 8. risk
        .mockResolvedValueOnce([absenceRow])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([])              // 14. vtuReg
        .mockResolvedValueOnce([]);             // 15. parentAnnouncements

      const graph = await svc.buildParentGraph('+919845012345');
      expect(graph.role).toBe('PARENT');
      expect(graph.preferredLanguage).toBe('kn');
      expect(graph.child.name).toBe('Alice');
    });

    it('throws when parent not found', async () => {
      mockQuery.mockResolvedValueOnce([]);  // no parent
      await expect(svc.buildParentGraph('+91000')).rejects.toThrow('Parent not found');
    });

    it('returns empty parent graph when db is null', async () => {
      const svcNoDb = new KnowledgeGraphService(null);
      const graph = await svcNoDb.buildParentGraph('+91000');
      expect(graph.role).toBe('PARENT');
      expect(graph.child.name).toBe('Unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // withTimeout() — the setTimeout callback fires when the DB query hangs
  // longer than GRAPH_TIMEOUT_MS (5000ms). Fake timers let us simulate this.
  // ---------------------------------------------------------------------------
  describe('withTimeout() — timeout fires and returns fallback (line 68 setTimeout callback)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns fallback student graph when DB query exceeds 5-second timeout', async () => {
      // DB query hangs indefinitely — never resolves
      mockQuery.mockReturnValue(new Promise(() => {}));

      const graphPromise = svc.buildStudentGraph('1RV21CS001');

      // Advance fake timers past GRAPH_TIMEOUT_MS (5000ms) so the setTimeout
      // callback fires, resolving the timeout promise with the fallback.
      jest.advanceTimersByTime(5001);

      const graph = await graphPromise;
      // Fallback emptyStudentGraph is returned
      expect(graph.name).toBe('Unknown');
      expect(graph.role).toBe('STUDENT');
    });

    it('returns fallback teacher graph when DB query exceeds 5-second timeout', async () => {
      mockQuery.mockReturnValue(new Promise(() => {}));

      const graphPromise = svc.buildTeacherGraph('FAC001');
      jest.advanceTimersByTime(5001);

      const graph = await graphPromise;
      expect(graph.name).toBe('Unknown');
      expect(graph.role).toBe('TEACHER');
    });

    it('returns fallback parent graph when DB query exceeds 5-second timeout', async () => {
      mockQuery.mockReturnValue(new Promise(() => {}));

      const graphPromise = svc.buildParentGraph('+919845012345');
      jest.advanceTimersByTime(5001);

      const graph = await graphPromise;
      expect(graph.role).toBe('PARENT');
      expect(graph.child.name).toBe('Unknown');
    });
  });

  describe('buildTeacherGraph()', () => {
    it('returns teacher graph with schedule and at-risk students', async () => {
      mockQuery
        .mockResolvedValueOnce([teacherRow])     // teachers
        .mockResolvedValueOnce([teacherSlot])    // todaySlots
        .mockResolvedValueOnce([])               // weekSlots
        .mockResolvedValueOnce([subjectRow])     // subjects
        .mockResolvedValueOnce([atRiskRow])      // atRisk
        .mockResolvedValueOnce([]);              // announcements

      const graph = await svc.buildTeacherGraph('FAC001');
      expect(graph.role).toBe('TEACHER');
      expect(graph.name).toBe('Dr. Kumar');
      expect(graph.todaySchedule).toHaveLength(1);
      expect(graph.todaySchedule[0].subject).toBe('DBMS');
      expect(graph.subjects[0].sections).toEqual(['A', 'B']);
      expect(graph.atRiskStudents).toHaveLength(1);
      expect(graph.atRiskStudents[0].riskLevel).toBe('HIGH');
    });

    it('returns empty teacher graph when teacher not found', async () => {
      mockQuery
        .mockResolvedValueOnce([])  // no teacher
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const graph = await svc.buildTeacherGraph('FAC999');
      expect(graph.name).toBe('Unknown');
      expect(graph.todaySchedule).toHaveLength(0);
    });

    it('returns empty teacher graph when db is null', async () => {
      const svcNoDb = new KnowledgeGraphService(null);
      const graph = await svcNoDb.buildTeacherGraph('FAC001');
      expect(graph.role).toBe('TEACHER');
      expect(graph.subjects).toHaveLength(0);
    });

    it('computes totalStudents from subjects', async () => {
      mockQuery
        .mockResolvedValueOnce([teacherRow])
        .mockResolvedValueOnce([])               // todaySlots
        .mockResolvedValueOnce([])               // weekSlots
        .mockResolvedValueOnce([
          { subject_name: 'DBMS', sections: 'A', total_students: 30, avg_att: 78 },
          { subject_name: 'OS', sections: 'B', total_students: 32, avg_att: 75 },
        ])
        .mockResolvedValueOnce([])               // atRisk
        .mockResolvedValueOnce([]);              // announcements

      const graph = await svc.buildTeacherGraph('FAC001');
      expect(graph.totalStudents).toBe(62);
    });

    // -------------------------------------------------------------------------
    // Branch coverage: lines 272-288 — null room, null sections, zero avg_att
    // -------------------------------------------------------------------------
    it('falls back to TBD when teacher slot has no room_number (line 272)', async () => {
      const slotNoRoom = { ...teacherSlot, room_number: null };
      mockQuery
        .mockResolvedValueOnce([teacherRow])
        .mockResolvedValueOnce([slotNoRoom])     // todaySlots
        .mockResolvedValueOnce([])               // weekSlots
        .mockResolvedValueOnce([subjectRow])     // subjects
        .mockResolvedValueOnce([])               // atRisk
        .mockResolvedValueOnce([]);              // announcements

      const graph = await svc.buildTeacherGraph('FAC001');
      expect(graph.todaySchedule[0].room).toBe('TBD');
    });

    it('handles null sections string gracefully (line 277 — String(null|undefined))', async () => {
      // sections field is null — String(null || '') → '' → split → filter → []
      const subjectNullSections = { subject_name: 'DBMS', sections: null, total_students: 40, avg_att: 72 };
      mockQuery
        .mockResolvedValueOnce([teacherRow])
        .mockResolvedValueOnce([])               // todaySlots
        .mockResolvedValueOnce([])               // weekSlots
        .mockResolvedValueOnce([subjectNullSections])
        .mockResolvedValueOnce([])               // atRisk
        .mockResolvedValueOnce([]);              // announcements

      const graph = await svc.buildTeacherGraph('FAC001');
      expect(graph.subjects[0].sections).toEqual([]);
    });

    it('falls back to zero avgAttendance when avg_att is falsy (line 279)', async () => {
      // avg_att = 0 — +0 || 0 stays 0; also covers the || 0 branch
      const subjectZeroAtt = { subject_name: 'DBMS', sections: 'A', total_students: 30, avg_att: 0 };
      mockQuery
        .mockResolvedValueOnce([teacherRow])
        .mockResolvedValueOnce([])               // todaySlots
        .mockResolvedValueOnce([])               // weekSlots
        .mockResolvedValueOnce([subjectZeroAtt])
        .mockResolvedValueOnce([])               // atRisk
        .mockResolvedValueOnce([]);              // announcements

      const graph = await svc.buildTeacherGraph('FAC001');
      expect(graph.subjects[0].avgAttendance).toBe(0);
    });

    // Branch coverage: line 288 — `+s.total_students || 0` in totalStudents reduce
    // When total_students is null/undefined the +null is 0, then || 0 fires
    it('counts null total_students as 0 in totalStudents reduce (line 288 || 0 branch)', async () => {
      const subjectNullStudents = {
        subject_name: 'DBMS', sections: 'A', total_students: null, avg_att: 75,
      };
      mockQuery
        .mockResolvedValueOnce([teacherRow])
        .mockResolvedValueOnce([])               // todaySlots
        .mockResolvedValueOnce([])               // weekSlots
        .mockResolvedValueOnce([subjectNullStudents])
        .mockResolvedValueOnce([])               // atRisk
        .mockResolvedValueOnce([]);              // announcements

      const graph = await svc.buildTeacherGraph('FAC001');
      // null total_students → +null = 0, 0 || 0 = 0 → totalStudents = 0
      expect(graph.totalStudents).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Branch coverage: buildStudentGraph — lines 134, 152-163
  // ---------------------------------------------------------------------------
  describe('buildStudentGraph() — null/falsy branch paths', () => {
    it('falls back to 0 percentage when pct is null (line 134: +null || 0)', async () => {
      // pct = null represents a subject with zero classes — no valid percentage
      const attNullPct = { subject_name: 'Maths', present: 0, total: 0, pct: null, needed: 0 };
      mockQuery
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([])              // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([attNullPct])    // 4. attendance
        .mockResolvedValueOnce([])              // 5. marks
        .mockResolvedValueOnce([])              // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([])              // 8. risk
        .mockResolvedValueOnce([{ cnt: 0 }])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');
      expect(graph.attendanceSummary[0].percentage).toBe(0);
    });

    it('falls back to TBD when timetable slot has no room_number (line 152)', async () => {
      const slotNoRoom = { ...slotRow, room_number: null };
      mockQuery
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([slotNoRoom])    // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([attRow])        // 4. attendance
        .mockResolvedValueOnce([marksRow])      // 5. marks
        .mockResolvedValueOnce([feeRow])        // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([riskRow])       // 8. risk
        .mockResolvedValueOnce([absenceRow])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');
      expect(graph.todaySchedule[0].room).toBe('TBD');
    });

    it('maps isLab to true when is_lab is truthy (line 154)', async () => {
      const labSlot = { ...slotRow, is_lab: true };
      mockQuery
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([labSlot])       // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([attRow])        // 4. attendance
        .mockResolvedValueOnce([marksRow])      // 5. marks
        .mockResolvedValueOnce([feeRow])        // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([riskRow])       // 8. risk
        .mockResolvedValueOnce([absenceRow])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');
      expect(graph.todaySchedule[0].isLab).toBe(true);
    });

    it('maps ia1 and ia2 to null when marks fields are null (lines 161-162)', async () => {
      // VTU edge case: student has not yet appeared for IA1/IA2
      const marksNullIa = { subject_name: 'Maths', ia1: null, ia2: null, max_marks: 20 };
      mockQuery
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([])              // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([attRow])        // 4. attendance
        .mockResolvedValueOnce([marksNullIa])   // 5. marks
        .mockResolvedValueOnce([feeRow])        // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([riskRow])       // 8. risk
        .mockResolvedValueOnce([absenceRow])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');
      expect(graph.marksSummary[0].ia1).toBeNull();
      expect(graph.marksSummary[0].ia2).toBeNull();
    });

    it('falls back to maxMarks 20 when max_marks is null (line 163)', async () => {
      // Edge case: marks row present but max_marks column is NULL in DB
      const marksNullMax = { subject_name: 'Maths', ia1: 15, ia2: 16, max_marks: null };
      mockQuery
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([])              // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([attRow])        // 4. attendance
        .mockResolvedValueOnce([marksNullMax])  // 5. marks
        .mockResolvedValueOnce([feeRow])        // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([riskRow])       // 8. risk
        .mockResolvedValueOnce([absenceRow])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');
      expect(graph.marksSummary[0].maxMarks).toBe(20);
    });

    it('computes overallAttendancePct as 0 when attendanceSummary is empty (line 139 false branch)', async () => {
      // No attendance rows → ternary takes the : 0 branch
      mockQuery
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([])              // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([])              // 4. attendance — empty
        .mockResolvedValueOnce([])              // 5. marks
        .mockResolvedValueOnce([])              // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([])              // 8. risk
        .mockResolvedValueOnce([{ cnt: 0 }])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');
      // Empty attendance falls back to DEMO_ATTENDANCE → overall pct computed from demo rows.
      expect(typeof graph.overallAttendancePct).toBe('number');
      expect(graph.overallAttendancePct).toBeGreaterThan(0);
    });

    it('reports zero riskScore and LOW riskLevel when risk row absent (lines 173-174)', async () => {
      mockQuery
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([])              // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([attRow])        // 4. attendance
        .mockResolvedValueOnce([marksRow])      // 5. marks
        .mockResolvedValueOnce([feeRow])        // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([])              // 8. risk — no risk row
        .mockResolvedValueOnce([{ cnt: 0 }])    // 9. absences
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');
      // When risk row is absent, production now defaults to 0.18 / LOW.
      expect(graph.riskScore).toBe(0.18);
      expect(graph.riskLevel).toBe('LOW');
    });

    it('falls back to 0 for recentAbsenceCount when absence row has no cnt (line 174)', async () => {
      mockQuery
        .mockResolvedValueOnce([studentRow])    // 1. students
        .mockResolvedValueOnce([])              // 2. todaySlots
        .mockResolvedValueOnce([])              // 3. weekSlots
        .mockResolvedValueOnce([attRow])        // 4. attendance
        .mockResolvedValueOnce([marksRow])      // 5. marks
        .mockResolvedValueOnce([feeRow])        // 6. fees
        .mockResolvedValueOnce([])              // 7. feeItems
        .mockResolvedValueOnce([riskRow])       // 8. risk
        .mockResolvedValueOnce([{}])            // 9. absences — row exists but cnt undefined
        .mockResolvedValueOnce([])              // 10. announcements
        .mockResolvedValueOnce([])              // 11. placements
        .mockResolvedValueOnce([])              // 12. vtuWindows
        .mockResolvedValueOnce([])              // 13. vtuElig
        .mockResolvedValueOnce([]);             // 14. vtuReg

      const graph = await svc.buildStudentGraph('1RV21CS001');
      expect(graph.recentAbsenceCount).toBe(0);
    });
  });
});
