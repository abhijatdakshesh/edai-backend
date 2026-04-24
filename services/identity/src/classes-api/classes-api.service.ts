import { Injectable, NotFoundException } from '@nestjs/common';

export interface ClassRecord {
  id: string;
  name: string;
  departmentCode: string;
  semester: number;
  section: string;
  /** Total enrolled students — single source of truth (strength === studentCount) */
  strength: number;
  classTeacherId: string;
  classTeacherName: string;
  subject: string;
  subjectCode: string;
  instructorId: string;
  instructorName: string;
  /** @deprecated use strength */
  studentCount: number;
}

export interface StudentRoster {
  usn: string;
  name: string;
  dept: string;
}

export interface TeacherDashboard {
  totalStudents: number;
  atRiskCount: number;
  classesToday: number;
  pendingMarksEntry: number;
  atRiskStudents: Array<{ usn: string; name: string; risk: string }>;
}

@Injectable()
export class ClassesApiService {
  classes: ClassRecord[] = [
    { id: 'cls-1', name: 'CSE-A', departmentCode: 'CSE', semester: 5, section: 'A', strength: 60, classTeacherId: 'fac-1', classTeacherName: 'Dr. Sharma', subject: 'Data Structures', subjectCode: 'CS501', instructorId: 'fac-1', instructorName: 'Dr. Sharma', studentCount: 60 },
    { id: 'cls-2', name: 'CSE-B', departmentCode: 'CSE', semester: 5, section: 'B', strength: 58, classTeacherId: 'fac-2', classTeacherName: 'Dr. Reddy', subject: 'Algorithms', subjectCode: 'CS502', instructorId: 'fac-2', instructorName: 'Dr. Reddy', studentCount: 58 },
    { id: 'cls-3', name: 'ECE-A', departmentCode: 'ECE', semester: 3, section: 'A', strength: 55, classTeacherId: 'fac-3', classTeacherName: 'Dr. Patel', subject: 'Signals & Systems', subjectCode: 'EC301', instructorId: 'fac-3', instructorName: 'Dr. Patel', studentCount: 55 },
    { id: 'cls-4', name: 'ME-A', departmentCode: 'ME', semester: 3, section: 'A', strength: 45, classTeacherId: 'fac-4', classTeacherName: 'Dr. Kumar', subject: 'Thermodynamics', subjectCode: 'ME301', instructorId: 'fac-4', instructorName: 'Dr. Kumar', studentCount: 45 },
  ];
  rosters: Map<string, StudentRoster[]> = new Map();

  getTeacherClasses(teacherId: string): ClassRecord[] {
    return this.classes.filter((c) => c.instructorId === teacherId);
  }

  getAllClasses(): ClassRecord[] {
    return this.classes;
  }

  getTeacherDashboard(teacherId: string): TeacherDashboard {
    const teacherClasses = this.getTeacherClasses(teacherId);
    const totalStudents = teacherClasses.reduce(
      (sum, c) => sum + c.studentCount,
      0,
    );
    return {
      totalStudents,
      atRiskCount: Math.floor(totalStudents * 0.1),
      classesToday: Math.min(teacherClasses.length, 3),
      pendingMarksEntry: 2,
      atRiskStudents: [
        { usn: '1RV21CS003', name: 'Priya Sharma', risk: 'HIGH' },
        { usn: '1RV21CS005', name: 'Ravi Kumar', risk: 'MEDIUM' },
      ],
    };
  }

  getClassStudents(classId: string): StudentRoster[] {
    return this.rosters.get(classId) ?? [];
  }

  getClassById(id: string): ClassRecord {
    const cls = this.classes.find((c) => c.id === id);
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  getStudentsByClass(classId: string): Array<{ usn: string; name: string; attendancePct: number }> {
    const roster = this.rosters.get(classId) ?? [];
    return roster.map((s) => ({
      usn: s.usn,
      name: s.name,
      attendancePct: Math.floor(70 + Math.random() * 25),
    }));
  }
}
