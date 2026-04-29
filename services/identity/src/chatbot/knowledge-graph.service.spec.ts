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
        .mockResolvedValueOnce([studentRow])   // profile
        .mockResolvedValueOnce([slotRow])       // timetable
        .mockResolvedValueOnce([attRow])        // attendance
        .mockResolvedValueOnce([marksRow])      // marks
        .mockResolvedValueOnce([feeRow])        // fees
        .mockResolvedValueOnce([riskRow])       // risk
        .mockResolvedValueOnce([absenceRow]);   // absences

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
        .mockResolvedValueOnce([])  // profile — empty
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ cnt: 0 }]);

      const graph = await svc.buildStudentGraph('UNKNOWN');
      expect(graph.name).toBe('Unknown');
      expect(graph.todaySchedule).toHaveLength(0);
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
        .mockResolvedValueOnce([studentRow])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([lowAtt])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ cnt: 0 }]);

      const graph = await svc.buildStudentGraph('1RV21CS001');
      expect(graph.detentionRisk).toBe(true);
    });

    it('handles missing fee record gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([studentRow])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])  // no fee row
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ cnt: 0 }]);

      const graph = await svc.buildStudentGraph('1RV21CS001');
      expect(graph.feeStatus.status).toBe('UNKNOWN');
    });
  });

  describe('buildParentGraph()', () => {
    it('returns parent graph wrapping child student graph', async () => {
      mockQuery
        .mockResolvedValueOnce([{ usn: '1RV21CS001', lang: 'kn' }])  // parent lookup
        .mockResolvedValueOnce([studentRow])   // student profile
        .mockResolvedValueOnce([slotRow])
        .mockResolvedValueOnce([attRow])
        .mockResolvedValueOnce([marksRow])
        .mockResolvedValueOnce([feeRow])
        .mockResolvedValueOnce([riskRow])
        .mockResolvedValueOnce([absenceRow]);

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

  describe('buildTeacherGraph()', () => {
    it('returns teacher graph with schedule and at-risk students', async () => {
      mockQuery
        .mockResolvedValueOnce([teacherRow])
        .mockResolvedValueOnce([teacherSlot])
        .mockResolvedValueOnce([subjectRow])
        .mockResolvedValueOnce([atRiskRow]);

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
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { subject_name: 'DBMS', sections: 'A', total_students: 30, avg_att: 78 },
          { subject_name: 'OS', sections: 'B', total_students: 32, avg_att: 75 },
        ])
        .mockResolvedValueOnce([]);

      const graph = await svc.buildTeacherGraph('FAC001');
      expect(graph.totalStudents).toBe(62);
    });
  });
});
