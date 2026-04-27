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
export declare class AttendanceApiService {
    records: AttendanceRecord[];
    getStudentAttendanceSummary(usn: string): Array<{
        courseId: string;
        courseName: string;
        courseCode: string;
        totalClasses: number;
        attended: number;
        pct: number;
        canMiss: number;
        mustAttend: number;
    }>;
    getClassAttendanceSummary(classId: string): {
        classId: string;
        className: string;
        date: string;
        totalStudents: number;
        present: number;
        absent: number;
        late: number;
        pct: number;
    };
    getAtRiskStudents(classId: string): Array<{
        usn: string;
        name: string;
        pct: number;
        parentPhone: string;
        lastCallDate?: string;
    }>;
    getStudentAttendance(usn: string): StudentAttendanceSummary;
    markBulk(classId: string, date: string, entries: Array<{
        usn: string;
        status: 'P' | 'A' | 'L';
    }>, markedBy: string): AttendanceRecord[];
    getTeacherSummary(teacherId: string): ClassAttendanceSummary[];
    getClassStudents(classId: string): Array<{
        usn: string;
        name: string;
    }>;
    getAuditLog(): AttendanceRecord[];
    correctRecord(id: string, status: 'P' | 'A' | 'L', editedBy: string): AttendanceRecord;
}
