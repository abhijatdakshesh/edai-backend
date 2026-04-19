import { Injectable } from '@nestjs/common';

export interface ClassRecord {
  id: string;
  name: string;
  subject: string;
  subjectCode: string;
  semester: number;
  instructorId: string;
  instructorName: string;
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
  classes: ClassRecord[] = [];
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
}
