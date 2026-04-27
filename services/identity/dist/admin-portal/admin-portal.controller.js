"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminPortalController = void 0;
const common_1 = require("@nestjs/common");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const admin_portal_service_1 = require("./admin-portal.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../roles/roles.guard");
const roles_decorator_1 = require("../roles/roles.decorator");
let AdminPortalController = class AdminPortalController {
    constructor(svc) {
        this.svc = svc;
    }
    getDashboard() {
        return this.svc.getDashboard();
    }
    getReports() {
        return this.svc.getReports();
    }
    getAttendanceTrend(_institutionId) {
        return this.svc.getAttendanceTrend();
    }
    getFeeCollection(_year) {
        return this.svc.getFeeCollection();
    }
    getDeptAttendance() {
        return this.svc.getDeptAttendance();
    }
    getNaac() {
        return this.svc.getNaac();
    }
    getNaacMetrics() {
        return this.svc.getNaacMetrics();
    }
    getPlacementSummary() {
        return this.svc.getPlacementSummary();
    }
    getPlacementPredictions(dept, likelihood) {
        return this.svc.getPlacementPredictions(dept, likelihood);
    }
    triggerBulkImport(body) {
        return this.svc.triggerBulkImport(body.entityType, body.fileUrl);
    }
    async exportAnalytics(type = 'analytics', format = 'csv', res) {
        const safeType = type.replace(/[^a-zA-Z0-9 _-]/g, '_');
        const safeFormat = ['csv', 'xlsx', 'pdf'].includes(format.toLowerCase()) ? format.toLowerCase() : 'csv';
        const rows = this.svc.getExportRows(safeType);
        const filename = `${safeType.replace(/ /g, '_')}_export`;
        if (safeFormat === 'xlsx') {
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Report');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
            return res.end(buffer);
        }
        if (safeFormat === 'pdf') {
            const doc = new PDFDocument({ margin: 40 });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
            doc.pipe(res);
            doc.fontSize(16).text(`EdAI Report: ${safeType}`, { underline: true }).moveDown();
            doc.fontSize(10).fillColor('grey').text(`Generated: ${new Date().toLocaleString('en-IN')}`).fillColor('black').moveDown();
            if (rows.length > 0) {
                const headers = Object.keys(rows[0]);
                doc.fontSize(11).font('Helvetica-Bold').text(headers.join('   |   ')).moveDown(0.5);
                doc.font('Helvetica').fontSize(10);
                for (const row of rows) {
                    doc.text(Object.values(row).map(String).join('   |   ')).moveDown(0.2);
                }
            }
            doc.end();
            return;
        }
        const headers = rows.length > 0 ? Object.keys(rows[0]).join(',') : 'data';
        const csvBody = rows.map((r) => Object.values(r).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.end(`${headers}\n${csvBody}`);
    }
    downloadExport(body, res) {
        const ALLOWED_EXTS = { CSV: 'csv', XLSX: 'xlsx', PDF: 'pdf', VTU: 'txt' };
        const CONTENT_TYPES = {
            csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            pdf: 'application/pdf', txt: 'text/plain',
        };
        const safeType = (body.type ?? 'export').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeExt = ALLOWED_EXTS[(body.format ?? '').toUpperCase()] ?? 'csv';
        const data = this.svc.exportAnalytics(safeType);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="export_${safeType}.csv"`);
        const rows = Array.isArray(data) ? data : [data];
        const headers = rows.length > 0 ? Object.keys(rows[0]).join(',') : 'data';
        const body_csv = rows.map((r) => Object.values(r).map(String).join(',')).join('\n');
        return `${headers}\n${body_csv}`;
    }
    getClassPerformance(classId) {
        return this.svc.getClassPerformance(classId);
    }
};
exports.AdminPortalController = AdminPortalController;
__decorate([
    (0, common_1.Get)('analytics/admin/dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('analytics/admin/reports'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getReports", null);
__decorate([
    (0, common_1.Get)('analytics/attendance-trend'),
    __param(0, (0, common_1.Query)('institutionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getAttendanceTrend", null);
__decorate([
    (0, common_1.Get)('analytics/fee-collection'),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getFeeCollection", null);
__decorate([
    (0, common_1.Get)('analytics/attendance/by-department'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getDeptAttendance", null);
__decorate([
    (0, common_1.Get)('admin/naac'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getNaac", null);
__decorate([
    (0, common_1.Get)('admin/naac/metrics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getNaacMetrics", null);
__decorate([
    (0, common_1.Get)('admin/placements/summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getPlacementSummary", null);
__decorate([
    (0, common_1.Get)('admin/placements/predictions'),
    __param(0, (0, common_1.Query)('dept')),
    __param(1, (0, common_1.Query)('likelihood')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getPlacementPredictions", null);
__decorate([
    (0, common_1.Post)('admin/bulk-import/trigger'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "triggerBulkImport", null);
__decorate([
    (0, common_1.Get)('analytics/export'),
    __param(0, (0, common_1.Query)('type')),
    __param(1, (0, common_1.Query)('format')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminPortalController.prototype, "exportAnalytics", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'TRUSTEE'),
    (0, common_1.Post)('exports/download'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "downloadExport", null);
__decorate([
    (0, common_1.Get)('analytics/performance'),
    __param(0, (0, common_1.Query)('classId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getClassPerformance", null);
exports.AdminPortalController = AdminPortalController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'TRUSTEE'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [admin_portal_service_1.AdminPortalService])
], AdminPortalController);
//# sourceMappingURL=admin-portal.controller.js.map