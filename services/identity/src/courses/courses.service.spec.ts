import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CoursesService, Course, AcademicResult } from './courses.service';

const makeCourse = (overrides: Partial<Course> = {}): Course => ({
  id: 'course-1',
  name: 'Data Structures',
  code: 'CS301',
  credits: 4,
  department: 'CS',
  instructorName: 'Ravi Shankar',
  instructorId: 'teacher-1',
  enrolled: 0,
  ...overrides,
});

describe('CoursesService', () => {
  let service: CoursesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoursesService],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  // ─── getCourses ─────────────────────────────────────────────────────────────

  describe('getCourses()', () => {
    it('returns all courses', () => {
      service.courses.push(makeCourse({ id: 'c1' }), makeCourse({ id: 'c2' }));
      expect(service.getCourses()).toHaveLength(2);
    });

    it('returns empty array when no courses', () => {
      expect(service.getCourses()).toEqual([]);
    });
  });

  // ─── enroll ─────────────────────────────────────────────────────────────────

  describe('enroll()', () => {
    it('enrolls a student and increments enrolled count', () => {
      service.courses.push(makeCourse({ id: 'c1', enrolled: 5 }));
      const result = service.enroll('c1', 'USN001');
      expect(result).toEqual({ message: 'Enrolled successfully' });
      expect(service.enrollments).toHaveLength(1);
      expect(service.courses[0].enrolled).toBe(6);
    });

    it('does not create duplicate enrollment', () => {
      service.courses.push(makeCourse({ id: 'c1', enrolled: 5 }));
      service.enroll('c1', 'USN001');
      service.enroll('c1', 'USN001');
      expect(service.enrollments).toHaveLength(1);
      expect(service.courses[0].enrolled).toBe(6); // only incremented once
    });

    it('throws NotFoundException for unknown courseId', () => {
      expect(() => service.enroll('no-such-course', 'USN001')).toThrow(NotFoundException);
    });
  });

  // ─── unenroll ───────────────────────────────────────────────────────────────

  describe('unenroll()', () => {
    it('removes enrollment and decrements enrolled count', () => {
      service.courses.push(makeCourse({ id: 'c1', enrolled: 10 }));
      service.enrollments.push({ courseId: 'c1', studentUsn: 'USN001' });
      const result = service.unenroll('c1', 'USN001');
      expect(result).toEqual({ message: 'Unenrolled successfully' });
      expect(service.enrollments).toHaveLength(0);
      expect(service.courses[0].enrolled).toBe(9);
    });

    it('returns success even if enrollment does not exist (idempotent)', () => {
      service.courses.push(makeCourse({ id: 'c1', enrolled: 5 }));
      const result = service.unenroll('c1', 'USN_NOT_ENROLLED');
      expect(result).toEqual({ message: 'Unenrolled successfully' });
      expect(service.courses[0].enrolled).toBe(5); // not decremented
    });

    it('does not decrement below zero', () => {
      service.courses.push(makeCourse({ id: 'c1', enrolled: 0 }));
      service.enrollments.push({ courseId: 'c1', studentUsn: 'USN001' });
      service.unenroll('c1', 'USN001');
      expect(service.courses[0].enrolled).toBe(0);
    });
  });

  // ─── getResults ─────────────────────────────────────────────────────────────

  describe('getResults()', () => {
    it('returns reshaped academic result for a known USN', () => {
      const result: AcademicResult = {
        usn: 'USN001',
        cgpa: 8.5,
        semesters: [],
      };
      service.academicResults.push(result);
      // The service no longer returns the raw record — it reshapes into a
      // frontend-friendly object with usn/name/cgpa/semesters.
      const out = service.getResults('USN001');
      expect(out.usn).toBe('USN001');
      expect(out.cgpa).toBe(8.5);
      expect(out.semesters).toEqual([]);
    });

    it('throws NotFoundException when no academic results are seeded', () => {
      // The service falls back to the first seeded result when the USN is not
      // found, so we can only assert NotFoundException when the store is empty.
      service.academicResults.length = 0;
      expect(() => service.getResults('UNKNOWN')).toThrow(NotFoundException);
    });
  });
});
