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

  getResults(usn: string): AcademicResult {
    const result = this.academicResults.find((r) => r.usn === usn);
    if (!result) throw new NotFoundException('Results not found for USN');
    return result;
  }
}
