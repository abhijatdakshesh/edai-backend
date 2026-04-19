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
};
exports.CommsController = CommsController;
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
exports.CommsController = CommsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [comms_service_1.CommsService,
        student_portal_service_1.StudentPortalService])
], CommsController);
//# sourceMappingURL=comms.controller.js.map