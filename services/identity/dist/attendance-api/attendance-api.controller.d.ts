import { AttendanceApiService } from './attendance-api.service';
import { EventsGateway } from '../events/events.gateway';
export declare class AttendanceApiController {
    private readonly svc;
    private readonly events;
    constructor(svc: AttendanceApiService, events: EventsGateway);
    getStudentAttendance(usn: string): import("./attendance-api.service").StudentAttendanceSummary;
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
