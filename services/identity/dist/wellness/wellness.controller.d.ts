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
    bookSessionAlias(body: {
        slotId: string;
        reason: string;
    }, req: any): import("./wellness.service").CounselorSession;
    getMyRiskScore(req: any): import("./wellness.service").RiskScore;
    completeTask(id: string): import("./wellness.service").StudyTask;
    getResourcesAlias(): import("./wellness.service").WellnessResource[];
    stressAssessment(body: {
        answers: Record<string, number>;
    }, req: any): {
        score: number;
        level: "LOW" | "MEDIUM" | "HIGH";
        recommendations: string[];
    };
    generateStudyPlan(body: {
        examDate: string;
        subjects: string[];
    }, req: any): {
        tasks: import("./wellness.service").StudyTask[];
    };
}
