import { CommsService } from './comms.service';
import { StudentPortalService } from '../student-portal/student-portal.service';
export declare class CommsController {
    private readonly svc;
    private readonly studentPortalSvc;
    constructor(svc: CommsService, studentPortalSvc: StudentPortalService);
    getRecentCalls(): import("./comms.service").AICallLog[];
    getParentCalls(parentId: string): import("./comms.service").AICallLog[];
    getParentMessages(parentId: string): import("./comms.service").Message[];
    getAdminCallLogs(): import("./comms.service").AICallLog[];
}
