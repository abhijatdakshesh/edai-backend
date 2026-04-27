import { VtuService } from './vtu.service';
import { EventsGateway } from '../events/events.gateway';
export declare class VtuController {
    private readonly svc;
    private readonly events;
    constructor(svc: VtuService, events: EventsGateway);
    getAllWindows(): import("./vtu.service").VtuWindow[];
    getActiveWindow(): import("./vtu.service").VtuWindow | null;
    createWindow(body: {
        title: string;
        openDate: string;
        closeDate: string;
        semester: number;
    }): import("./vtu.service").VtuWindow;
    getStudentStatus(windowId: string, req: any): {
        status: string;
        eligibleSubjects: string[];
        ineligibleSubjects: string[];
        registeredSubjects: string[];
    };
    registerStudent(body: {
        windowId: string;
        subjectCodes: string[];
    }, req: any): import("./vtu.service").VtuRegistration;
    getPendingStudents(windowId: string): {
        usn: string;
        name: string;
        dept: string;
    }[];
    getDeptOverview(windowId: string): {
        dept: string;
        eligible: number;
        registered: number;
    }[];
    sendReminders(body: {
        windowId: string;
        usnList: string[];
    }): {
        reminded: string[];
        windowId: string;
    };
    runEligibility(body: {
        windowId: string;
    }): {
        processed: number;
        windowId: string;
    };
    getChildVtuStatus(usn: string, windowId: string): {
        status: string;
        eligibleSubjects: string[];
        ineligibleSubjects: string[];
        registeredSubjects: string[];
    };
    getWindow(id: string): import("./vtu.service").VtuWindow;
    getDeptOverviewByWindow(wId: string): {
        dept: string;
        eligible: number;
        registered: number;
    }[];
    getPendingByWindow(wId: string): {
        usn: string;
        name: string;
        dept: string;
    }[];
    remindByWindow(wId: string, body: {
        usnList: string[];
    }): {
        reminded: string[];
        windowId: string;
    };
    eligibilityCheck(wId: string): {
        processed: number;
        windowId: string;
    };
}
