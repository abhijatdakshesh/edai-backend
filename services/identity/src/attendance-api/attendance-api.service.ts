import { Injectable, NotFoundException } from '@nestjs/common';

export interface AttendanceRecord {
  id: string;
  classId: string;
  date: string;
  usn: string;
  status: 'P' | 'A' | 'L';
  subjectCode: string;
  subjectName: string;
  markedBy?: string;
  editedBy?: string;
  editedAt?: string;
  studentName?: string;
}

export interface SubjectAttendance {
  code: string;
  name: string;
  held: number;
  attended: number;
  pct: number;
}

export interface StudentAttendanceSummary {
  overall: number;
  subjects: SubjectAttendance[];
}

export interface ClassAttendanceSummary {
  classId: string;
  className: string;
  subjectCode: string;
  subject: string;
  totalStudents: number;
  avgAttendancePct: number;
}

@Injectable()
export class AttendanceApiService {
  records: AttendanceRecord[] = [];

  /**
   * Per-course breakdown shaped for the student portal attendance page.
   * Route: GET attendance/student/:usn/summary
   */
  getStudentAttendanceSummary(usn: string): Array<{
    courseId: string;
    courseName: string;
    courseCode: string;
    totalClasses: number;
    attended: number;
    pct: number;
    canMiss: number;
    mustAttend: number;
  }> {
    const studentRecords = this.records.filter((r) => r.usn === usn);
    if (studentRecords.length === 0) {
      throw new NotFoundException('Attendance records not found for USN');
    }

    const subjectMap = new Map<
      string,
      { name: string; classId: string; held: number; attended: number }
    >();
    for (const r of studentRecords) {
      if (!subjectMap.has(r.subjectCode)) {
        subjectMap.set(r.subjectCode, { name: r.subjectName, classId: r.classId, held: 0, attended: 0 });
      }
      const entry = subjectMap.get(r.subjectCode)!;
      entry.held++;
      if (r.status === 'P') entry.attended++;
    }

    return Array.from(subjectMap.entries()).map(([code, data]) => {
      const pct = data.held ? Math.round((data.attended / data.held) * 100) : 0;
      // canMiss: how many future classes can be skipped while staying ≥ 75%
      const canMiss = Math.max(0, Math.floor((data.attended - 0.75 * data.held) / 0.75));
      // mustAttend: future consecutive classes needed to reach 75% (if below)
      const mustAttend = pct >= 75
        ? 0
        : Math.max(0, Math.ceil((0.75 * data.held - data.attended) / 0.25));

      return {
        courseId: data.classId,
        courseName: data.name,
        courseCode: code,
        totalClasses: data.held,
        attended: data.attended,
        pct,
        canMiss,
        mustAttend,
      };
    });
  }

  /**
   * Single-class attendance summary for a given date (or overall).
   * Route: GET attendance/class/:classId/summary
   */
  getClassAttendanceSummary(classId: string): {
    classId: string;
    className: string;
    date: string;
    totalStudents: number;
    present: number;
    absent: number;
    late: number;
    pct: number;
  } {
    const classRecords = this.records.filter((r) => r.classId === classId);
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = classRecords.filter((r) => r.date === today);
    const targetRecords = todayRecords.length > 0 ? todayRecords : classRecords;

    const students = [...new Set(targetRecords.map((r) => r.usn))];
    const present = targetRecords.filter((r) => r.status === 'P').length;
    const absent = targetRecords.filter((r) => r.status === 'A').length;
    const late = targetRecords.filter((r) => r.status === 'L').length;
    const total = present + absent + late;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      classId,
      className: `Class ${classId}`,
      date: today,
      totalStudents: students.length,
      present,
      absent,
      late,
      pct,
    };
  }

  /**
   * Students below 75% attendance threshold for a given class.
   * Route: GET attendance/class/:classId/at-risk
   */
  getAtRiskStudents(classId: string): Array<{
    usn: string;
    name: string;
    pct: number;
    parentPhone: string;
    lastCallDate?: string;
  }> {
    const classRecords = this.records.filter((r) => r.classId === classId);
    const usnMap = new Map<string, { name: string; held: number; attended: number }>();

    for (const r of classRecords) {
      if (!usnMap.has(r.usn)) {
        usnMap.set(r.usn, { name: r.studentName ?? r.usn, held: 0, attended: 0 });
      }
      const entry = usnMap.get(r.usn)!;
      entry.held++;
      if (r.status === 'P') entry.attended++;
    }

    return Array.from(usnMap.entries())
      .map(([usn, data]) => ({
        usn,
        name: data.name,
        pct: data.held ? Math.round((data.attended / data.held) * 100) : 0,
        parentPhone: '+91-9900000000',
      }))
      .filter((s) => s.pct < 75);
  }

  getStudentAttendance(usn: string): StudentAttendanceSummary {
    const studentRecords = this.records.filter((r) => r.usn === usn);
    if (studentRecords.length === 0) {
      throw new NotFoundException('Attendance records not found for USN');
    }

    const subjectMap = new Map<
      string,
      { name: string; held: number; attended: number }
    >();
    for (const r of studentRecords) {
      const key = r.subjectCode;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, { name: r.subjectName, held: 0, attended: 0 });
      }
      const entry = subjectMap.get(key)!;
      entry.held++;
      if (r.status === 'P') entry.attended++;
    }

    const subjects: SubjectAttendance[] = [];
    let totalHeld = 0;
    let totalAttended = 0;
    for (const [code, data] of subjectMap) {
      subjects.push({
        code,
        name: data.name,
        held: data.held,
        attended: data.attended,
        pct: Math.round((data.attended / data.held) * 100),
      });
      totalHeld += data.held;
      totalAttended += data.attended;
    }

    return {
      overall: totalHeld ? Math.round((totalAttended / totalHeld) * 100) : 0,
      subjects,
    };
  }

  markBulk(
    classId: string,
    date: string,
    entries: Array<{ usn: string; status: 'P' | 'A' | 'L' }>,
    markedBy: string,
  ): AttendanceRecord[] {
    const newRecords: AttendanceRecord[] = [];
    for (const entry of entries) {
      const existing = this.records.find(
        (r) => r.classId === classId && r.date === date && r.usn === entry.usn,
      );
      if (existing) {
        existing.status = entry.status;
        existing.editedBy = markedBy;
        existing.editedAt = new Date().toISOString();
        newRecords.push(existing);
      } else {
        const record: AttendanceRecord = {
          id: `att-${Date.now()}-${entry.usn}`,
          classId,
          date,
          usn: entry.usn,
          status: entry.status,
          subjectCode: 'UNKNOWN',
          subjectName: 'Unknown',
          markedBy,
        };
        this.records.push(record);
        newRecords.push(record);
      }
    }
    return newRecords;
  }

  getTeacherSummary(teacherId: string): ClassAttendanceSummary[] {
    const classIds = [...new Set(this.records.map((r) => r.classId))];
    return classIds.map((classId) => {
      const classRecords = this.records.filter((r) => r.classId === classId);
      const subjectCode = classRecords[0]?.subjectCode ?? 'N/A';
      const students = [...new Set(classRecords.map((r) => r.usn))];
      const attendedByStudent = students.map(
        (usn) =>
          classRecords.filter((r) => r.usn === usn && r.status === 'P').length /
          Math.max(classRecords.filter((r) => r.usn === usn).length, 1),
      );
      const avg =
        attendedByStudent.length > 0
          ? Math.round(
              (attendedByStudent.reduce((a, b) => a + b, 0) /
                attendedByStudent.length) *
                100,
            )
          : 0;
      return {
        classId,
        className: `Class ${classId}`,
        subjectCode,
        subject: classRecords[0]?.subjectName ?? 'Unknown',
        totalStudents: students.length,
        avgAttendancePct: avg,
      };
    });
  }

  getClassStudents(classId: string): Array<{ usn: string; name: string }> {
    const usns = [
      ...new Set(
        this.records.filter((r) => r.classId === classId).map((r) => r.usn),
      ),
    ];
    return usns.map((usn) => ({ usn, name: `Student ${usn}` }));
  }

  getAuditLog(): AttendanceRecord[] {
    return this.records.filter((r) => r.editedBy);
  }

  correctRecord(
    id: string,
    status: 'P' | 'A' | 'L',
    editedBy: string,
  ): AttendanceRecord {
    const record = this.records.find((r) => r.id === id);
    if (!record) throw new NotFoundException('Attendance record not found');
    record.status = status;
    record.editedBy = editedBy;
    record.editedAt = new Date().toISOString();
    return record;
  }
}
