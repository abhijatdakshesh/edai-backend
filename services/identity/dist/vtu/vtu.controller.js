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
exports.VtuController = void 0;
const common_1 = require("@nestjs/common");
const vtu_service_1 = require("./vtu.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const events_gateway_1 = require("../events/events.gateway");
let VtuController = class VtuController {
    constructor(svc, events) {
        this.svc = svc;
        this.events = events;
    }
    getAllWindows() {
        return this.svc.getAllWindows();
    }
    getActiveWindow() {
        return this.svc.getActiveWindow();
    }
    createWindow(body) {
        const win = this.svc.createWindow(body);
        this.events.emitVtuWindowOpened({ windowId: win.id, title: win.title });
        return win;
    }
    getStudentStatus(windowId, req) {
        const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.getStudentStatus(usn, windowId);
    }
    registerStudent(body, req) {
        const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.registerStudent(usn, body.windowId, body.subjectCodes);
    }
    getPendingStudents(windowId) {
        return this.svc.getPendingStudents(windowId);
    }
    getDeptOverview(windowId) {
        return this.svc.getDeptOverview(windowId);
    }
    sendReminders(body) {
        return this.svc.sendReminders(body.windowId, body.usnList);
    }
    runEligibility(body) {
        return this.svc.runEligibility(body.windowId);
    }
    getChildVtuStatus(usn, windowId) {
        return this.svc.getStudentStatus(usn, windowId);
    }
    getWindow(id) {
        return this.svc.getWindowById(id);
    }
    getDeptOverviewByWindow(wId) {
        return this.svc.getDeptOverview(wId);
    }
    getPendingByWindow(wId) {
        return this.svc.getPendingStudents(wId);
    }
    remindByWindow(wId, body) {
        return this.svc.sendReminders(wId, body.usnList);
    }
    eligibilityCheck(wId) {
        return this.svc.runEligibility(wId);
    }
};
exports.VtuController = VtuController;
__decorate([
    (0, common_1.Get)('vtu/windows'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "getAllWindows", null);
__decorate([
    (0, common_1.Get)('vtu/windows/active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "getActiveWindow", null);
__decorate([
    (0, common_1.Post)('vtu/windows'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "createWindow", null);
__decorate([
    (0, common_1.Get)('vtu/student/status'),
    __param(0, (0, common_1.Query)('windowId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "getStudentStatus", null);
__decorate([
    (0, common_1.Post)('vtu/student/register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "registerStudent", null);
__decorate([
    (0, common_1.Get)('vtu/admin/pending'),
    __param(0, (0, common_1.Query)('windowId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "getPendingStudents", null);
__decorate([
    (0, common_1.Get)('vtu/admin/dept-overview'),
    __param(0, (0, common_1.Query)('windowId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "getDeptOverview", null);
__decorate([
    (0, common_1.Post)('vtu/admin/remind'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "sendReminders", null);
__decorate([
    (0, common_1.Post)('vtu/admin/run-eligibility'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "runEligibility", null);
__decorate([
    (0, common_1.Get)('parent/children/:usn/vtu-status'),
    __param(0, (0, common_1.Param)('usn')),
    __param(1, (0, common_1.Query)('windowId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "getChildVtuStatus", null);
__decorate([
    (0, common_1.Get)('vtu/windows/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "getWindow", null);
__decorate([
    (0, common_1.Get)('vtu/windows/:windowId/dept-overview'),
    __param(0, (0, common_1.Param)('windowId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "getDeptOverviewByWindow", null);
__decorate([
    (0, common_1.Get)('vtu/windows/:windowId/pending'),
    __param(0, (0, common_1.Param)('windowId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "getPendingByWindow", null);
__decorate([
    (0, common_1.Post)('vtu/windows/:windowId/remind'),
    __param(0, (0, common_1.Param)('windowId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "remindByWindow", null);
__decorate([
    (0, common_1.Post)('vtu/windows/:windowId/eligibility-check'),
    __param(0, (0, common_1.Param)('windowId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VtuController.prototype, "eligibilityCheck", null);
exports.VtuController = VtuController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [vtu_service_1.VtuService,
        events_gateway_1.EventsGateway])
], VtuController);
//# sourceMappingURL=vtu.controller.js.map