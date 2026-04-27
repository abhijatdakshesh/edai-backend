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
exports.IaController = void 0;
const common_1 = require("@nestjs/common");
const ia_service_1 = require("./ia.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const events_gateway_1 = require("../events/events.gateway");
let IaController = class IaController {
    constructor(svc, events) {
        this.svc = svc;
        this.events = events;
    }
    getMarks(subjectCode, sem) {
        return this.svc.getMarks(subjectCode, parseInt(sem, 10));
    }
    saveMarks(body, req) {
        const teacherId = req.user?.sub ?? 'unknown';
        return this.svc.saveMarks(body.subjectCode, body.sem, body.marks, teacherId);
    }
    submitForReview(body, req) {
        const teacherId = req.user?.sub ?? 'unknown';
        return this.svc.submitForReview(body.subjectCode, body.sem, teacherId);
    }
    getAllSubmissions() {
        return this.svc.getAllSubmissions();
    }
    confirm(id) {
        const result = this.svc.confirm(id);
        this.events.emitIaSubmissionUpdated({
            submissionId: id,
            status: result.status,
        });
        return result;
    }
    sendReminders(body) {
        return this.svc.sendReminders(body.teacherIds);
    }
    uploadResults(body) {
        return this.svc.uploadResults(body.subjectCode, body.sem);
    }
    submitBySubjectId(subjectId, req) {
        const teacherId = req.user?.sub ?? 'unknown';
        return this.svc.submitForReview(subjectId, 5, teacherId);
    }
    getMarksBySubject(subjectId) {
        return this.svc.getMarksBySubject(subjectId);
    }
    bulkSaveMarks(body, req) {
        const _teacherId = req.user?.sub ?? 'unknown';
        return { jobId: `bulk-${Date.now()}`, status: 'QUEUED', count: body.marks.length };
    }
    confirmBulkMarks(body) {
        return { ok: true, jobId: body.jobId, confirmedAt: new Date().toISOString() };
    }
};
exports.IaController = IaController;
__decorate([
    (0, common_1.Get)('ia/teacher/marks'),
    __param(0, (0, common_1.Query)('subjectCode')),
    __param(1, (0, common_1.Query)('sem')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], IaController.prototype, "getMarks", null);
__decorate([
    (0, common_1.Post)('ia/teacher/marks'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], IaController.prototype, "saveMarks", null);
__decorate([
    (0, common_1.Post)('ia/teacher/marks/submit'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], IaController.prototype, "submitForReview", null);
__decorate([
    (0, common_1.Get)('ia/submissions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], IaController.prototype, "getAllSubmissions", null);
__decorate([
    (0, common_1.Post)('ia/submissions/:id/confirm'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IaController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)('ia/submissions/remind'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IaController.prototype, "sendReminders", null);
__decorate([
    (0, common_1.Post)('teacher/upload-results'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IaController.prototype, "uploadResults", null);
__decorate([
    (0, common_1.Patch)('ia/teacher/marks/:subjectId/submit'),
    __param(0, (0, common_1.Param)('subjectId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], IaController.prototype, "submitBySubjectId", null);
__decorate([
    (0, common_1.Get)('academics/marks/subject/:subjectId'),
    __param(0, (0, common_1.Param)('subjectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IaController.prototype, "getMarksBySubject", null);
__decorate([
    (0, common_1.Post)('academics/marks/bulk'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], IaController.prototype, "bulkSaveMarks", null);
__decorate([
    (0, common_1.Post)('academics/marks/bulk/confirm'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IaController.prototype, "confirmBulkMarks", null);
exports.IaController = IaController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [ia_service_1.IaService,
        events_gateway_1.EventsGateway])
], IaController);
//# sourceMappingURL=ia.controller.js.map