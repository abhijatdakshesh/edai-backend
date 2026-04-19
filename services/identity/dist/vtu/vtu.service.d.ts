export interface VtuWindow {
    id: string;
    title: string;
    openDate: string;
    closeDate: string;
    semester: number;
    isActive: boolean;
}
export interface VtuRegistration {
    windowId: string;
    usn: string;
    subjectCodes: string[];
    registeredAt: string;
}
export interface VtuEligibility {
    windowId: string;
    usn: string;
    eligibleSubjects: string[];
    isEligible: boolean;
}
export declare class VtuService {
    windows: VtuWindow[];
    registrations: VtuRegistration[];
    eligibilities: VtuEligibility[];
    getAllWindows(): VtuWindow[];
    getActiveWindow(): VtuWindow | null;
    createWindow(data: {
        title: string;
        openDate: string;
        closeDate: string;
        semester: number;
    }): VtuWindow;
    getStudentStatus(usn: string, windowId: string): {
        status: string;
        eligibleSubjects: string[];
        registeredSubjects: string[];
    };
    registerStudent(usn: string, windowId: string, subjectCodes: string[]): VtuRegistration;
    getPendingStudents(windowId: string): Array<{
        usn: string;
        name: string;
        dept: string;
    }>;
    getDeptOverview(windowId: string): Array<{
        dept: string;
        eligible: number;
        registered: number;
    }>;
    sendReminders(windowId: string, usnList: string[]): {
        reminded: string[];
        windowId: string;
    };
    runEligibility(windowId: string): {
        processed: number;
        windowId: string;
    };
}
