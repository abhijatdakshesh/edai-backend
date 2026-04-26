import { Response } from 'express';
import { AdminPortalService } from './admin-portal.service';
export declare class AdminPortalController {
    private readonly svc;
    constructor(svc: AdminPortalService);
    getDashboard(): import("./admin-portal.service").AdminDashboard;
    getReports(): import("./admin-portal.service").AdminReport[];
    getAttendanceTrend(_institutionId?: string): {
        month: string;
        pct: number;
    }[];
    getFeeCollection(_year?: string): {
        month: string;
        collected: number;
        target: number;
    }[];
    getDeptAttendance(): {
        dept: string;
        avgPct: number;
        belowThreshold: number;
    }[];
    getNaac(): import("./admin-portal.service").NaacReport;
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
    triggerBulkImport(body: {
        entityType: 'students' | 'faculty' | 'classes' | 'courses';
        fileUrl: string;
    }): import("./admin-portal.service").BulkImportResult;
    exportAnalytics(type: string | undefined, format: string | undefined, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    downloadExport(body: {
        type: string;
        format: string;
        filters?: Record<string, unknown>;
        requestedBy?: string;
    }, res: Response): string;
    getClassPerformance(classId?: string): {
        avgCgpa: number;
        topCgpa: number;
        below5: number;
        passRate: number;
    };
}
