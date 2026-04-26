import { AttendanceApiService } from '../attendance-api/attendance-api.service';
import { AssignmentsApiService } from '../assignments-api/assignments-api.service';
import { FeesApiService } from '../fees-api/fees-api.service';
import { CoursesService } from '../courses/courses.service';
export interface ScheduleEntry {
    dayOfWeek: string;
    subject: string;
    room: string;
    startTime: string;
    endTime: string;
}
export interface HostelInfo {
    roomNumber: string;
    block: string;
    warden: string;
    messMenu: Array<{
        day: string;
        breakfast: string;
        lunch: string;
        dinner: string;
    }>;
}
export interface TransportInfo {
    route: string;
    pickupPoint: string;
    timing: string;
}
export interface ExamPrepInfo {
    stressLevel: number;
    subjectReadiness: Array<{
        subject: string;
        readiness: number;
        tip: string;
    }>;
    resources: Array<{
        title: string;
        url: string;
        type: string;
    }>;
}
export interface StaffMember {
    name: string;
    role: string;
    department: string;
    email: string;
    phone: string;
}
export declare class StudentPortalService {
    private readonly attendanceSvc;
    private readonly assignmentsSvc;
    private readonly feesSvc;
    private readonly coursesSvc;
    schedules: Map<string, ScheduleEntry[]>;
    hostelData: Map<string, {
        hostel: HostelInfo;
        transport: TransportInfo;
    }>;
    staff: StaffMember[];
    constructor(attendanceSvc: AttendanceApiService, assignmentsSvc: AssignmentsApiService, feesSvc: FeesApiService, coursesSvc: CoursesService);
    getDashboard(usn: string): {
        stats: {
            attendancePct: number;
            cgpa: number;
            pendingAssignments: number;
            feeStatus: "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";
        };
        upcoming: ({
            date: string;
            event: string;
            type: "assignment";
        } | {
            date: string;
            event: string;
            type: "exam";
        } | {
            date: string;
            event: string;
            type: "event";
        })[];
        courses: {
            code: string;
            name: string;
            faculty: string;
            attendance: number;
            nextClass: string;
        }[];
    };
    getSchedule(usn: string): {
        schedule: ScheduleEntry[];
    };
    getHostel(usn: string): {
        hostel: HostelInfo;
        transport: TransportInfo;
    };
    getExamPrep(usn: string): ExamPrepInfo;
    getStaff(): StaffMember[];
}
