// ─── Department ────────────────────────────────────────────────────────────────
export interface Department {
  code: string; // PK e.g. "CSE"
  name: string; // e.g. "Computer Science & Engineering"
  hodUserId: string;
  established: number; // year
  active: boolean;
  createdAt: string;
}

// ─── Class ─────────────────────────────────────────────────────────────────────
export interface Class {
  id: string;
  name: string; // e.g. "CSE 6A"
  departmentCode: string;
  semester: number; // 1-8
  section: string; // "A" | "B" | ...
  strength: number;
  classTeacherId: string;
  academicYear: string; // e.g. "2024-25"
  createdAt: string;
}

// ─── ClassEnrollment ───────────────────────────────────────────────────────────
export interface ClassEnrollment {
  id: string;
  classId: string;
  studentUsn: string;
  studentName: string;
  enrolledAt: string;
}

// ─── Course ────────────────────────────────────────────────────────────────────
export type CourseType = 'THEORY' | 'LAB' | 'ELECTIVE';

export interface Course {
  id: string;
  code: string; // VTU code e.g. "21CS61"
  name: string;
  departmentCode: string;
  semester: number;
  credits: number;
  type: CourseType;
  syllabusUrl?: string;
  active: boolean;
  createdAt: string;
}

// ─── CourseAssignment ──────────────────────────────────────────────────────────
export interface CourseAssignment {
  id: string;
  courseId: string;
  classId: string;
  facultyId: string;
  academicYear: string;
  createdAt: string;
}
