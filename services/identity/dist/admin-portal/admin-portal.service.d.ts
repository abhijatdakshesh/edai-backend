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
    getAttendanceTrend(): {
        month: string;
        pct: number;
    }[];
    getFeeCollection(): {
        month: string;
        collected: number;
        target: number;
    }[];
    getDeptAttendance(): {
        dept: string;
        avgPct: number;
        belowThreshold: number;
    }[];
    getNaacMetrics(): {
        overallScore: number;
        grade: string;
        lastAssessed: string;
        upcomingAuditDate: string;
        criteria: {
            id: string;
            name: string;
            score: number;
            maxScore: number;
            lastUpdated: string;
            trend: string;
        }[];
        strengths: string[];
        areasForImprovement: string[];
    };
    getPlacementSummary(): {
        total: number;
        high: number;
        medium: number;
        low: number;
        veryLow: number;
        avgCgpa: number;
        avgSkillScore: number;
    };
    getPlacementPredictions(dept?: string, likelihood?: string): ({
        studentUsn: string;
        studentName: string;
        dept: string;
        semester: number;
        cgpa: number;
        attendancePct: number;
        skillScore: number;
        mockInterviewScore: number;
        likelihood: string;
        predictedPackage: string;
        matchedCompanies: string[];
        gaps: string[];
    } | {
        studentUsn: string;
        studentName: string;
        dept: string;
        semester: number;
        cgpa: number;
        attendancePct: number;
        skillScore: number;
        likelihood: string;
        predictedPackage: string;
        matchedCompanies: string[];
        gaps: string[];
        mockInterviewScore?: undefined;
    })[];
    triggerBulkImport(entityType: string, fileUrl: string): BulkImportResult;
    exportAnalytics(type?: string): {
        url: string;
        filename: string;
        generatedAt: string;
    };
    getExportRows(type: string): Record<string, unknown>[];
    getClassPerformance(classId?: string): {
        avgCgpa: number;
        topCgpa: number;
        below5: number;
        passRate: number;
    };
}
