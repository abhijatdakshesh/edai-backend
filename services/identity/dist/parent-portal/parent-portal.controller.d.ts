import { ParentPortalService } from './parent-portal.service';
export declare class ParentPortalController {
    private readonly svc;
    constructor(svc: ParentPortalService);
    getDashboard(req: any): import("./parent-portal.service").ParentDashboard;
    getChildren(req: any): import("./parent-portal.service").ChildInfo[];
    getChildAttendance(usn: string): import("../attendance-api/attendance-api.service").StudentAttendanceSummary;
    getChildResults(usn: string): import("../courses/courses.service").AcademicResult;
    getChildFees(usn: string): import("../fees-api/fees-api.service").FeeSummary;
}
