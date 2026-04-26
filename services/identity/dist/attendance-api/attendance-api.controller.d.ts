import { AttendanceApiService } from './attendance-api.service';
import { EventsGateway } from '../events/events.gateway';
export declare class AttendanceApiController {
    private readonly svc;
    private readonly events;
    constructor(svc: AttendanceApiService, events: EventsGateway);
    getStudentAttendanceSummary(usn: string): {
        courseId: string;
        courseName: string;
        courseCode: string;
        totalClasses: number;
        attended: number;
        pct: number;
        canMiss: number;
        mustAttend: number;
    }[];
    getStudentAttendance(usn: string): import("./attendance-api.service").StudentAttendanceSummary;
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
    getAtRiskStudents(classId: string): {
        usn: string;
        name: string;
        pct: number;
        parentPhone: string;
        lastCallDate?: string;
    }[];
    markBulkAlt(body: {
        classId: string;
        date: string;
        entries: Array<{
            studentUsn: string;
            status: 'PRESENT' | 'ABSENT' | 'LATE';
        }>;
    }, req: any): import("./attendance-api.service").AttendanceRecord[];
    markBulk(body: {
        classId: string;
        date: string;
        records: Array<{
            usn: string;
            status: 'P' | 'A' | 'L';
        }>;
    }, req: any): import("./attendance-api.service").AttendanceRecord[];
    getTeacherSummary(req: any): import("./attendance-api.service").ClassAttendanceSummary[];
    getClassStudents(id: string): {
        usn: string;
        name: string;
    }[];
    getAuditLog(): import("./attendance-api.service").AttendanceRecord[];
    correctRecord(id: string, body: {
        status: 'P' | 'A' | 'L';
    }, req: any): import("./attendance-api.service").AttendanceRecord;
}
