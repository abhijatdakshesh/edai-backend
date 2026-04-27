import { AttendanceApiService } from '../attendance-api/attendance-api.service';
import { FeesApiService } from '../fees-api/fees-api.service';
import { CoursesService } from '../courses/courses.service';
export interface ChildInfo {
    usn: string;
    name: string;
    semester: number;
    dept: string;
    cgpa: number;
    attendance: number;
}
export interface ParentDashboard {
    children: ChildInfo[];
    pendingFees: number;
    recentNotifications: Array<{
        id: string;
        message: string;
        sentAt: string;
    }>;
}
export declare class ParentPortalService {
    private readonly attendanceSvc;
    private readonly feesSvc;
    private readonly coursesSvc;
    parentChildMap: Map<string, string[]>;
    childProfiles: Map<string, ChildInfo>;
    constructor(attendanceSvc: AttendanceApiService, feesSvc: FeesApiService, coursesSvc: CoursesService);
    getChildren(parentId: string): ChildInfo[];
    getDashboard(parentId: string): ParentDashboard;
    getChildAttendance(usn: string): import("../attendance-api/attendance-api.service").StudentAttendanceSummary;
    getChildResults(usn: string): import("../courses/courses.service").AcademicResult;
    getChildFees(usn: string): import("../fees-api/fees-api.service").FeeSummary;
    getChild(usn: string): {
        usn: string;
        name: string;
        dept: string;
        semester: number;
        cgpa: number;
        attendancePct: number;
        feeStatus: string;
    };
    payFees(usn: string, amount: number, feeIds: string[]): {
        receiptId: string;
        paidAt: string;
        amount: number;
    };
    checkScholarship(usn: string): {
        eligible: boolean;
        schemes: Array<{
            name: string;
            amount: number;
            criteria: string;
        }>;
    };
}
