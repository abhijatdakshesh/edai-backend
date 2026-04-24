import { Test, TestingModule } from '@nestjs/testing';
import { ClassesApiService, ClassRecord, StudentRoster } from './classes-api.service';

const makeClass = (overrides: Partial<ClassRecord> = {}): ClassRecord => ({
  id: 'c1',
  name: 'CS-A',
  subject: 'Data Structures',
  subjectCode: 'CS301',
  semester: 5,
  instructorId: 'teacher-1',
  instructorName: 'Ravi Shankar',
  studentCount: 60,
  ...overrides,
});

describe('ClassesApiService', () => {
  let service: ClassesApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClassesApiService],
    }).compile();

    service = module.get<ClassesApiService>(ClassesApiService);
  });

  // ─── getTeacherClasses ──────────────────────────────────────────────────────

  describe('getTeacherClasses()', () => {
    it('returns classes for the given teacher', () => {
      service.classes.push(
        makeClass({ id: 'c1', instructorId: 'teacher-1' }),
        makeClass({ id: 'c2', instructorId: 'teacher-2' }),
      );
      const result = service.getTeacherClasses('teacher-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });

    it('returns empty array for unknown teacher', () => {
      expect(service.getTeacherClasses('no-teacher')).toEqual([]);
    });
  });

  // ─── getAllClasses ──────────────────────────────────────────────────────────

  describe('getAllClasses()', () => {
    it('returns all classes', () => {
      service.classes.push(makeClass({ id: 'c1' }), makeClass({ id: 'c2' }));
      expect(service.getAllClasses()).toHaveLength(2);
    });

    it('returns empty array when no classes exist', () => {
      expect(service.getAllClasses()).toEqual([]);
    });
  });

  // ─── getTeacherDashboard ────────────────────────────────────────────────────

  describe('getTeacherDashboard()', () => {
    it('returns correct totalStudents summed from teacher classes', () => {
      service.classes.push(
        makeClass({ instructorId: 'teacher-1', studentCount: 30 }),
        makeClass({ id: 'c2', instructorId: 'teacher-1', studentCount: 40 }),
      );
      const dashboard = service.getTeacherDashboard('teacher-1');
      expect(dashboard.totalStudents).toBe(70);
    });

    it('returns atRiskCount as 10% of totalStudents', () => {
      service.classes.push(makeClass({ instructorId: 'teacher-1', studentCount: 100 }));
      const dashboard = service.getTeacherDashboard('teacher-1');
      expect(dashboard.atRiskCount).toBe(10);
    });

    it('returns classesToday capped at 3', () => {
      for (let i = 0; i < 5; i++) {
        service.classes.push(makeClass({ id: `c${i}`, instructorId: 'teacher-1' }));
      }
      const dashboard = service.getTeacherDashboard('teacher-1');
      expect(dashboard.classesToday).toBe(3);
    });

    it('includes the two static at-risk students', () => {
      const dashboard = service.getTeacherDashboard('any-teacher');
      expect(dashboard.atRiskStudents).toHaveLength(2);
      expect(dashboard.atRiskStudents[0].usn).toBe('1RV21CS003');
    });

    it('returns zero totalStudents for unknown teacher', () => {
      const dashboard = service.getTeacherDashboard('unknown');
      expect(dashboard.totalStudents).toBe(0);
      expect(dashboard.classesToday).toBe(0);
    });
  });

  // ─── getClassStudents ───────────────────────────────────────────────────────

  describe('getClassStudents()', () => {
    it('returns students from the roster', () => {
      const roster: StudentRoster[] = [
        { usn: 'USN001', name: 'Alice', dept: 'CS' },
        { usn: 'USN002', name: 'Bob', dept: 'CS' },
      ];
      service.rosters.set('c1', roster);
      expect(service.getClassStudents('c1')).toEqual(roster);
    });

    it('returns empty array for unknown classId', () => {
      expect(service.getClassStudents('no-class')).toEqual([]);
    });
  });
});
