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
