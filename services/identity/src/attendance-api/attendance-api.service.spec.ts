import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttendanceApiService, AttendanceRecord } from './attendance-api.service';

function makeRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: `att-${Math.random()}`,
    classId: 'class-1',
    date: '2026-04-01',
    usn: 'USN001',
    status: 'P',
    subjectCode: 'CS301',
    subjectName: 'Data Structures',
    ...overrides,
  };
}

describe('AttendanceApiService', () => {
  let service: AttendanceApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttendanceApiService],
    }).compile();

    service = module.get<AttendanceApiService>(AttendanceApiService);
  });

  // ─── getStudentAttendanceSummary ──────────────────────────────────────────────

  describe('getStudentAttendanceSummary()', () => {
    it('throws NotFoundException when no records exist for USN', () => {
      expect(() => service.getStudentAttendanceSummary('USN_NONE')).toThrow(NotFoundException);
    });

    it('returns per-subject breakdown with pct/canMiss/mustAttend', () => {
      service.records.push(
        makeRecord({ usn: 'USN001', subjectCode: 'CS301', subjectName: 'DS', status: 'P', classId: 'c1' }),
        makeRecord({ usn: 'USN001', subjectCode: 'CS301', subjectName: 'DS', status: 'P', classId: 'c1' }),
        makeRecord({ usn: 'USN001', subjectCode: 'CS301', subjectName: 'DS', status: 'A', classId: 'c1' }),
        makeRecord({ usn: 'USN001', subjectCode: 'CS301', subjectName: 'DS', status: 'A', classId: 'c1' }),
      );

      const result = service.getStudentAttendanceSummary('USN001');
      expect(result).toHaveLength(1);
      const entry = result[0];
      expect(entry.courseCode).toBe('CS301');
      expect(entry.totalClasses).toBe(4);
      expect(entry.attended).toBe(2);
      expect(entry.pct).toBe(50);
      // below 75% → mustAttend > 0
      expect(entry.mustAttend).toBeGreaterThan(0);
      expect(entry.canMiss).toBe(0);
    });

    it('computes canMiss > 0 when attendance is above 75%', () => {
      // 4 present, 0 absent → 100%
      for (let i = 0; i < 4; i++) {
        service.records.push(makeRecord({ usn: 'USN002', status: 'P' }));
      }
      const result = service.getStudentAttendanceSummary('USN002');
      expect(result[0].pct).toBe(100);
      expect(result[0].canMiss).toBeGreaterThanOrEqual(1);
      expect(result[0].mustAttend).toBe(0);
    });
  });

  // ─── getStudentAttendance ─────────────────────────────────────────────────────

  describe('getStudentAttendance()', () => {
    it('throws NotFoundException when no records exist for USN', () => {
      expect(() => service.getStudentAttendance('USN_NONE')).toThrow(NotFoundException);
    });

    it('returns overall percentage and subjects array', () => {
      service.records.push(
        makeRecord({ usn: 'USN001', subjectCode: 'CS301', subjectName: 'DS', status: 'P' }),
        makeRecord({ usn: 'USN001', subjectCode: 'CS301', subjectName: 'DS', status: 'A' }),
        makeRecord({ usn: 'USN001', subjectCode: 'CS302', subjectName: 'DBMS', status: 'P' }),
        makeRecord({ usn: 'USN001', subjectCode: 'CS302', subjectName: 'DBMS', status: 'P' }),
      );
      const result = service.getStudentAttendance('USN001');
      expect(result.overall).toBe(75); // 3 present out of 4
      expect(result.subjects).toHaveLength(2);
    });
  });

  // ─── getClassAttendanceSummary ────────────────────────────────────────────────

  describe('getClassAttendanceSummary()', () => {
    it('returns zero counts for a class with no records', () => {
      const result = service.getClassAttendanceSummary('class-empty');
      expect(result.classId).toBe('class-empty');
      expect(result.totalStudents).toBe(0);
      expect(result.pct).toBe(0);
    });

    it('computes present/absent/late counts correctly', () => {
      const today = new Date().toISOString().split('T')[0];
      service.records.push(
        makeRecord({ classId: 'class-1', date: today, usn: 'U1', status: 'P' }),
        makeRecord({ classId: 'class-1', date: today, usn: 'U2', status: 'A' }),
        makeRecord({ classId: 'class-1', date: today, usn: 'U3', status: 'L' }),
      );
      const result = service.getClassAttendanceSummary('class-1');
      expect(result.present).toBe(1);
      expect(result.absent).toBe(1);
      expect(result.late).toBe(1);
      expect(result.pct).toBe(33);
    });

    it('falls back to all records when no today records', () => {
      // Record from a past date
      service.records.push(
        makeRecord({ classId: 'class-past', date: '2026-01-01', usn: 'U1', status: 'P' }),
        makeRecord({ classId: 'class-past', date: '2026-01-01', usn: 'U2', status: 'P' }),
      );
      const result = service.getClassAttendanceSummary('class-past');
      expect(result.present).toBe(2);
      expect(result.pct).toBe(100);
    });
  });

  // ─── getAtRiskStudents ────────────────────────────────────────────────────────

  describe('getAtRiskStudents()', () => {
    it('returns empty array when all students are above 75%', () => {
      service.records.push(
        makeRecord({ classId: 'c1', usn: 'U1', status: 'P' }),
        makeRecord({ classId: 'c1', usn: 'U1', status: 'P' }),
        makeRecord({ classId: 'c1', usn: 'U1', status: 'P' }),
        makeRecord({ classId: 'c1', usn: 'U1', status: 'P' }),
      );
      expect(service.getAtRiskStudents('c1')).toEqual([]);
    });

    it('returns students below 75%', () => {
      service.records.push(
        makeRecord({ classId: 'c2', usn: 'RISK001', studentName: 'Alice', status: 'P' }),
        makeRecord({ classId: 'c2', usn: 'RISK001', studentName: 'Alice', status: 'A' }),
        makeRecord({ classId: 'c2', usn: 'RISK001', studentName: 'Alice', status: 'A' }),
        makeRecord({ classId: 'c2', usn: 'RISK001', studentName: 'Alice', status: 'A' }),
      );
      const result = service.getAtRiskStudents('c2');
      expect(result).toHaveLength(1);
      expect(result[0].usn).toBe('RISK001');
      expect(result[0].pct).toBe(25);
    });

    it('uses usn as name fallback when studentName is absent', () => {
      service.records.push(
        makeRecord({ classId: 'c3', usn: 'NO_NAME', studentName: undefined, status: 'A' }),
        makeRecord({ classId: 'c3', usn: 'NO_NAME', studentName: undefined, status: 'A' }),
      );
      const result = service.getAtRiskStudents('c3');
      expect(result[0].name).toBe('NO_NAME');
    });

    it('returns empty array for unknown classId', () => {
      expect(service.getAtRiskStudents('no-such-class')).toEqual([]);
    });
  });

  // ─── markBulk ─────────────────────────────────────────────────────────────────

  describe('markBulk()', () => {
    it('creates new records when none exist', () => {
      const entries = [
        { usn: 'U1', status: 'P' as const },
        { usn: 'U2', status: 'A' as const },
      ];
      const result = service.markBulk('c1', '2026-04-20', entries, 'teacher-1');
      expect(result).toHaveLength(2);
      expect(service.records).toHaveLength(2);
    });

    it('updates existing record instead of creating duplicate', () => {
      const existing = makeRecord({ classId: 'c1', date: '2026-04-20', usn: 'U1', status: 'P' });
      service.records.push(existing);

      service.markBulk('c1', '2026-04-20', [{ usn: 'U1', status: 'A' }], 'teacher-1');
      expect(service.records).toHaveLength(1);
      expect(service.records[0].status).toBe('A');
      expect(service.records[0].editedBy).toBe('teacher-1');
    });

    it('sets markedBy on newly created records', () => {
      const result = service.markBulk('c1', '2026-04-20', [{ usn: 'U1', status: 'L' }], 'teacher-X');
      expect(result[0].markedBy).toBe('teacher-X');
    });
  });

  // ─── getTeacherSummary ────────────────────────────────────────────────────────

  describe('getTeacherSummary()', () => {
    it('returns empty array when no records', () => {
      expect(service.getTeacherSummary('teacher-1')).toEqual([]);
    });

    it('returns summary per classId', () => {
      service.records.push(
        makeRecord({ classId: 'c1', usn: 'U1', status: 'P', subjectCode: 'CS301', subjectName: 'DS' }),
        makeRecord({ classId: 'c1', usn: 'U2', status: 'A', subjectCode: 'CS301', subjectName: 'DS' }),
      );
      const result = service.getTeacherSummary('any');
      expect(result).toHaveLength(1);
      expect(result[0].classId).toBe('c1');
      expect(result[0].totalStudents).toBe(2);
    });
  });

  // ─── getClassStudents ─────────────────────────────────────────────────────────

  describe('getClassStudents()', () => {
    it('returns distinct students for a classId', () => {
      service.records.push(
        makeRecord({ classId: 'c1', usn: 'U1' }),
        makeRecord({ classId: 'c1', usn: 'U1' }),
        makeRecord({ classId: 'c1', usn: 'U2' }),
      );
      const result = service.getClassStudents('c1');
      expect(result).toHaveLength(2);
    });

    it('returns empty array for unknown classId', () => {
      expect(service.getClassStudents('no-class')).toEqual([]);
    });
  });

  // ─── getAuditLog ──────────────────────────────────────────────────────────────

  describe('getAuditLog()', () => {
    it('returns only records that have been edited', () => {
      service.records.push(
        makeRecord({ id: 'r1', editedBy: 'teacher-1' }),
        makeRecord({ id: 'r2' }), // no editedBy
      );
      const result = service.getAuditLog();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('r1');
    });

    it('returns empty array when no records have been edited', () => {
      service.records.push(makeRecord({ id: 'r1' }));
      expect(service.getAuditLog()).toEqual([]);
    });
  });

  // ─── VTU 75% exact boundary ──────────────────────────────────────────────────

  describe('getStudentAttendanceSummary() — VTU 75% exact boundary', () => {
    it('canMiss=0 and mustAttend=0 at exactly 75% (3P/1A)', () => {
      ['P', 'P', 'P', 'A'].forEach((s) =>
        service.records.push(makeRecord({ usn: 'USN_75', subjectCode: 'CS301', subjectName: 'DS', status: s as 'P' | 'A' | 'L' })),
      );
      const result = service.getStudentAttendanceSummary('USN_75');
      expect(result[0].pct).toBe(75);
      expect(result[0].canMiss).toBe(0);
      expect(result[0].mustAttend).toBe(0);
    });

    it('canMiss=8 at 90% attendance (36P/4A = 40 total)', () => {
      for (let i = 0; i < 36; i++) service.records.push(makeRecord({ usn: 'USN_90', subjectCode: 'CS301', subjectName: 'DS', status: 'P' }));
      for (let i = 0; i < 4; i++)  service.records.push(makeRecord({ usn: 'USN_90', subjectCode: 'CS301', subjectName: 'DS', status: 'A' }));
      const result = service.getStudentAttendanceSummary('USN_90');
      expect(result[0].pct).toBe(90);
      expect(result[0].canMiss).toBe(8);
    });

    it('mustAttend > 0 at 66.67% (2P/1A = 3 total) to reach 75%', () => {
      ['P', 'P', 'A'].forEach((s) =>
        service.records.push(makeRecord({ usn: 'USN_66', subjectCode: 'CS301', subjectName: 'DS', status: s as 'P' | 'A' | 'L' })),
      );
      const result = service.getStudentAttendanceSummary('USN_66');
      expect(result[0].pct).toBeLessThan(75);
      expect(result[0].mustAttend).toBeGreaterThan(0);
      expect(result[0].canMiss).toBe(0);
    });
  });

  // ─── correctRecord ────────────────────────────────────────────────────────────

  describe('correctRecord()', () => {
    it('updates status, editedBy, and editedAt on an existing record', () => {
      service.records.push(makeRecord({ id: 'r1', status: 'A' }));
      const result = service.correctRecord('r1', 'P', 'admin-1');
      expect(result.status).toBe('P');
      expect(result.editedBy).toBe('admin-1');
      expect(result.editedAt).toBeDefined();
    });

    it('throws NotFoundException for unknown record id', () => {
      expect(() => service.correctRecord('no-such-id', 'P', 'admin')).toThrow(NotFoundException);
    });
  });

  // ─── 75% attendance boundary (VTU eligibility threshold) ─────────────────────

  describe('getStudentAttendanceSummary() — VTU 75% boundary', () => {
    it('returns pct=75 and mustAttend=0 when student has exactly 3P/4H (75%)', () => {
      service.records.push(
        makeRecord({ usn: 'USN_75', subjectCode: 'CS399', subjectName: 'Boundary', status: 'P' }),
        makeRecord({ usn: 'USN_75', subjectCode: 'CS399', subjectName: 'Boundary', status: 'P' }),
        makeRecord({ usn: 'USN_75', subjectCode: 'CS399', subjectName: 'Boundary', status: 'P' }),
        makeRecord({ usn: 'USN_75', subjectCode: 'CS399', subjectName: 'Boundary', status: 'A' }),
      );
      const result = service.getStudentAttendanceSummary('USN_75');
      expect(result).toHaveLength(1);
      expect(result[0].pct).toBe(75);
      expect(result[0].mustAttend).toBe(0);
      expect(result[0].canMiss).toBe(0);
    });

    it('returns mustAttend > 0 when student is at 66% (2P/3H) — below threshold', () => {
      service.records.push(
        makeRecord({ usn: 'USN_66', subjectCode: 'CS400', subjectName: 'Below', status: 'P' }),
        makeRecord({ usn: 'USN_66', subjectCode: 'CS400', subjectName: 'Below', status: 'P' }),
        makeRecord({ usn: 'USN_66', subjectCode: 'CS400', subjectName: 'Below', status: 'A' }),
      );
      const result = service.getStudentAttendanceSummary('USN_66');
      expect(result[0].pct).toBe(67);
      expect(result[0].mustAttend).toBeGreaterThan(0);
      expect(result[0].canMiss).toBe(0);
    });

    it('returns pct=100 and canMiss > 0 when all classes attended', () => {
      for (let i = 0; i < 8; i++) {
        service.records.push(makeRecord({ usn: 'USN_100', subjectCode: 'CS401', subjectName: 'Perfect', status: 'P' }));
      }
      const result = service.getStudentAttendanceSummary('USN_100');
      expect(result[0].pct).toBe(100);
      expect(result[0].canMiss).toBeGreaterThan(0);
      expect(result[0].mustAttend).toBe(0);
    });
  });
});
