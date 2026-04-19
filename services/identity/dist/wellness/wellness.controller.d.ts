import { WellnessService } from './wellness.service';
export declare class WellnessController {
    private readonly svc;
    constructor(svc: WellnessService);
    getSlots(): import("./wellness.service").CounselorSlot[];
    getMySessions(req: any): import("./wellness.service").CounselorSession[];
    bookSession(body: {
        slotId: string;
        reason: string;
    }, req: any): import("./wellness.service").CounselorSession;
    getRiskScore(usn: string): import("./wellness.service").RiskScore;
    getStudyPlan(req: any): {
        tasks: import("./wellness.service").StudyTask[];
    };
    updateTask(id: string, body: {
        done: boolean;
    }): import("./wellness.service").StudyTask;
    getResources(): import("./wellness.service").WellnessResource[];
}
