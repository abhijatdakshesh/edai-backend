export interface CounselorSlot {
    id: string;
    dateTime: string;
    counsellorId: string;
    isBooked: boolean;
}
export interface CounselorSession {
    id: string;
    slotId: string;
    studentUsn: string;
    reason: string;
    status: 'BOOKED' | 'COMPLETED' | 'CANCELLED';
}
export interface StudyTask {
    id: string;
    usn: string;
    subject: string;
    title: string;
    done: boolean;
    dueDate: string;
}
export interface WellnessResource {
    title: string;
    type: string;
    url: string;
}
export interface RiskScore {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: string[];
}
export declare class WellnessService {
    slots: CounselorSlot[];
    sessions: CounselorSession[];
    studyTasks: StudyTask[];
    riskScores: Map<string, RiskScore>;
    readonly resources: WellnessResource[];
    getSlots(): CounselorSlot[];
    getMySessions(usn: string): CounselorSession[];
    bookSession(usn: string, slotId: string, reason: string): CounselorSession;
    getRiskScore(usn: string): RiskScore;
    getStudyPlan(usn: string): {
        tasks: StudyTask[];
    };
    updateTask(taskId: string, done: boolean): StudyTask;
    getResources(): WellnessResource[];
}
