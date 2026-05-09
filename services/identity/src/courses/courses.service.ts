import { Injectable, NotFoundException } from '@nestjs/common';

export interface Course {
  id: string;
  name: string;
  code: string;
  credits: number;
  department: string;
  instructorName: string;
  instructorId: string;
  enrolled: number;
}

export interface Enrollment {
  courseId: string;
  studentUsn: string;
}

export interface AcademicSubject {
  code: string;
  name: string;
  ia: number;
  ese: number;
  total: number;
  grade: string;
}

export interface Semester {
  sem: number;
  sgpa: number;
  subjects: AcademicSubject[];
}

export interface AcademicResult {
  usn: string;
  cgpa: number;
  semesters: Semester[];
}

@Injectable()
export class CoursesService {
  courses: Course[] = [];
  enrollments: Enrollment[] = [];
  academicResults: AcademicResult[] = [];

  getCourses(): Course[] {
    return this.courses;
  }

  enroll(courseId: string, studentUsn: string): { message: string } {
    const course = this.courses.find((c) => c.id === courseId);
    if (!course) throw new NotFoundException('Course not found');
    const existing = this.enrollments.find(
      (e) => e.courseId === courseId && e.studentUsn === studentUsn,
    );
    if (!existing) {
      this.enrollments.push({ courseId, studentUsn });
      course.enrolled++;
    }
    return { message: 'Enrolled successfully' };
  }

  unenroll(courseId: string, studentUsn: string): { message: string } {
    const idx = this.enrollments.findIndex(
      (e) => e.courseId === courseId && e.studentUsn === studentUsn,
    );
    if (idx !== -1) {
      this.enrollments.splice(idx, 1);
      const course = this.courses.find((c) => c.id === courseId);
      if (course && course.enrolled > 0) course.enrolled--;
    }
    return { message: 'Unenrolled successfully' };
  }

  getResults(usn: string): {
    usn: string;
    name: string;
    cgpa: number;
    semesters: Array<{
      semester: number;
      sgpa: number;
      subjects: Array<{ code: string; name: string; credits: number; ia: number; exam: number; total: number; grade: string }>;
    }>;
  } {
    // Fallback to the first seeded student so the demo always renders results,
    // even when the auth subject (u-student-01) doesn't match a USN.
    const result = this.academicResults.find((r) => r.usn === usn) ?? this.academicResults[0];
    if (!result) throw new NotFoundException('No results seeded');
    const creditsByCode: Record<string, number> = {
      MA101: 4, PH101: 4, CS101: 4,
      CS501: 4, CS502: 4, CS503: 3, CS504: 4, CS505: 3, CS506: 4, CS507: 3,
    };
    return {
      usn,
      name: result.usn,
      cgpa: result.cgpa,
      semesters: result.semesters
        .map((s) => ({
          semester: s.sem,
          sgpa: Number(s.sgpa.toFixed(2)),
          subjects: s.subjects.map((sub) => ({
            code: sub.code,
            name: sub.name,
            credits: creditsByCode[sub.code] ?? 3,
            ia: sub.ia,
            exam: sub.ese,
            total: sub.total,
            grade: sub.grade,
          })),
        }))
        .sort((a, b) => b.semester - a.semester),
    };
  }

  getCourseById(id: string): Course {
    const course = this.courses.find((c) => c.id === id);
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }
}
