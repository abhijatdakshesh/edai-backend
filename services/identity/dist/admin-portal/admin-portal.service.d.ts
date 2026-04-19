import { FeesApiService } from '../fees-api/fees-api.service';
export interface AdminDashboard {
    totalStudents: number;
    totalFaculty: number;
    avgAttendance: number;
    feesCollected: number;
    alerts: Array<{
        id: string;
        type: string;
        message: string;
        severity: string;
    }>;
}
export interface AdminReport {
    id: string;
    type: string;
    label: string;
    data: Record<string, unknown>;
}
export interface NaacReport {
    overallScore: number;
    criteria: Array<{
        name: string;
        score: number;
        maxScore: number;
    }>;
    strengths: string[];
    improvements: string[];
}
export interface BulkImportResult {
    jobId: string;
    entityType: string;
    status: string;
    message: string;
}
export declare class AdminPortalService {
    private readonly feesSvc;
    constructor(feesSvc: FeesApiService);
    getDashboard(): AdminDashboard;
    getReports(): AdminReport[];
    getNaac(): NaacReport;
    triggerBulkImport(entityType: string, fileUrl: string): BulkImportResult;
}
