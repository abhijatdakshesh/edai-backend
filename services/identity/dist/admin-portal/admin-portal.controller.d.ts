import { AdminPortalService } from './admin-portal.service';
export declare class AdminPortalController {
    private readonly svc;
    constructor(svc: AdminPortalService);
    getDashboard(): import("./admin-portal.service").AdminDashboard;
    getReports(): import("./admin-portal.service").AdminReport[];
    getNaac(): import("./admin-portal.service").NaacReport;
    triggerBulkImport(body: {
        entityType: 'students' | 'faculty' | 'classes' | 'courses';
        fileUrl: string;
    }): import("./admin-portal.service").BulkImportResult;
}
