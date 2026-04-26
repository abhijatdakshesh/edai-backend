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
exports.CommsController = void 0;
const common_1 = require("@nestjs/common");
const comms_service_1 = require("./comms.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const student_portal_service_1 = require("../student-portal/student-portal.service");
let CommsController = class CommsController {
    constructor(svc, studentPortalSvc) {
        this.svc = svc;
        this.studentPortalSvc = studentPortalSvc;
    }
    getAnnouncements(req) {
        const institutionId = req.user?.institutionId ?? process.env.INSTITUTION_ID;
        if (!institutionId)
            throw new common_1.BadRequestException('institutionId not resolvable from token');
        return this.svc.getAnnouncements(institutionId);
    }
    getCallsByClass(classId, req) {
        if (!classId)
            throw new common_1.BadRequestException('classId is required');
        const institutionId = req.user?.institutionId ?? process.env.INSTITUTION_ID;
        if (!institutionId)
            throw new common_1.BadRequestException('institutionId not resolvable from token');
        return this.svc.getCallsByClass(classId, institutionId);
    }
    getRecentCalls() {
        return this.svc.getRecentCalls();
    }
    getParentCalls(parentId) {
        return this.svc.getParentCalls(parentId);
    }
    getParentMessages(parentId) {
        return this.svc.getParentMessages(parentId);
    }
    getAdminCallLogs() {
        return this.svc.getAdminCallLogs();
    }
    triggerCall(body) {
        return this.svc.triggerCall(body.studentUsn, body.type);
    }
    sendSms(body) {
        return this.svc.sendSms(body.phone, body.message);
    }
    createAnnouncement(body, req) {
        const institutionId = req.user?.institutionId ?? process.env.INSTITUTION_ID ?? 'default';
        return this.svc.createAnnouncement(body.title, body.content, body.audience, institutionId);
    }
    triggerParentCall(body) {
        return this.svc.triggerParentCall(body.parentId, body.studentUsn);
    }
    getNotifications(req) {
        const parentId = req.user?.sub ?? 'unknown';
        return this.svc.getNotifications(parentId);
    }
    markAllRead(req) {
        const parentId = req.user?.sub ?? 'unknown';
        return this.svc.markAllRead(parentId);
    }
    markRead(id) {
        return this.svc.markNotificationRead(id);
    }
};
exports.CommsController = CommsController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('comms/announcements'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "getAnnouncements", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('comms/calls'),
    __param(0, (0, common_1.Query)('classId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "getCallsByClass", null);
__decorate([
    (0, common_1.Get)('comms/calls/recent'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "getRecentCalls", null);
__decorate([
    (0, common_1.Get)('parent-comms/calls'),
    __param(0, (0, common_1.Query)('parentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "getParentCalls", null);
__decorate([
    (0, common_1.Get)('parent-comms/messages'),
    __param(0, (0, common_1.Query)('parentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "getParentMessages", null);
__decorate([
    (0, common_1.Get)('admin/calls/logs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "getAdminCallLogs", null);
__decorate([
    (0, common_1.Post)('comms/calls/trigger'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "triggerCall", null);
__decorate([
    (0, common_1.Post)('comms/sms/send'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "sendSms", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('comms/announcements'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "createAnnouncement", null);
__decorate([
    (0, common_1.Post)('parent-comms/calls/trigger'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "triggerParentCall", null);
__decorate([
    (0, common_1.Get)('parent-comms/notifications'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Patch)('parent-comms/notifications/read-all'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "markAllRead", null);
__decorate([
    (0, common_1.Patch)('parent-comms/notifications/:id/read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CommsController.prototype, "markRead", null);
exports.CommsController = CommsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [comms_service_1.CommsService,
        student_portal_service_1.StudentPortalService])
], CommsController);
//# sourceMappingURL=comms.controller.js.map