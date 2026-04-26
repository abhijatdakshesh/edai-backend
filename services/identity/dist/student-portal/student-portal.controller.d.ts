import { StudentPortalService } from './student-portal.service';
export declare class StudentPortalController {
    private readonly svc;
    constructor(svc: StudentPortalService);
    getDashboard(req: any): {
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
    getSchedule(req: any): {
        schedule: import("./student-portal.service").ScheduleEntry[];
    };
    getHostel(req: any): {
        hostel: import("./student-portal.service").HostelInfo;
        transport: import("./student-portal.service").TransportInfo;
    };
    getExamPrep(req: any): import("./student-portal.service").ExamPrepInfo;
    getStaff(): import("./student-portal.service").StaffMember[];
    getInstitutionStaff(): import("./student-portal.service").StaffMember[];
}
