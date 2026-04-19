import { StudentPortalService } from './student-portal.service';
export declare class StudentPortalController {
    private readonly svc;
    constructor(svc: StudentPortalService);
    getDashboard(req: any): {
        attendance: number;
        cgpa: number;
        pendingAssignments: number;
        activeAlerts: string[];
        courses: {
            id: string;
            name: string;
            code: string;
        }[];
        upcomingEvents: {
            id: string;
            title: string;
            date: string;
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
