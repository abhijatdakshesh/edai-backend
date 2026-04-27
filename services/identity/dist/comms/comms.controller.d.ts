import { CommsService } from './comms.service';
import { StudentPortalService } from '../student-portal/student-portal.service';
export declare class CommsController {
    private readonly svc;
    private readonly studentPortalSvc;
    constructor(svc: CommsService, studentPortalSvc: StudentPortalService);
    getAnnouncements(req: any): import("./comms.service").Announcement[];
    getCallsByClass(classId: string, req: any): import("./comms.service").AICallLog[];
    getRecentCalls(): import("./comms.service").AICallLog[];
    getParentCalls(parentId: string): import("./comms.service").AICallLog[];
    getParentMessages(parentId: string): import("./comms.service").Message[];
    getAdminCallLogs(): import("./comms.service").AICallLog[];
    triggerCall(body: {
        studentUsn: string;
        type: string;
    }): {
        callId: string;
        status: "QUEUED";
        scheduledAt: string;
    };
    sendSms(body: {
        phone: string;
        message: string;
    }): {
        messageId: string;
        status: "SENT";
    };
    createAnnouncement(body: {
        title: string;
        content: string;
        audience: string;
    }, req: any): import("./comms.service").Announcement;
    triggerParentCall(body: {
        parentId: string;
        studentUsn: string;
    }): {
        callId: string;
        status: "QUEUED";
    };
    getNotifications(req: any): {
        id: string;
        type: string;
        title: string;
        message: string;
        read: boolean;
        createdAt: string;
    }[];
    markAllRead(req: any): {
        ok: true;
        count: number;
    };
    markRead(id: string): {
        ok: true;
    };
}
