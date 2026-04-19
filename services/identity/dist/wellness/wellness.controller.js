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
exports.WellnessController = void 0;
const common_1 = require("@nestjs/common");
const wellness_service_1 = require("./wellness.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let WellnessController = class WellnessController {
    constructor(svc) {
        this.svc = svc;
    }
    getSlots() {
        return this.svc.getSlots();
    }
    getMySessions(req) {
        const usn = req.user?.usn ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.getMySessions(usn);
    }
    bookSession(body, req) {
        const usn = req.user?.usn ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.bookSession(usn, body.slotId, body.reason);
    }
    getRiskScore(usn) {
        return this.svc.getRiskScore(usn);
    }
    getStudyPlan(req) {
        const usn = req.user?.usn ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.getStudyPlan(usn);
    }
    updateTask(id, body) {
        return this.svc.updateTask(id, body.done);
    }
    getResources() {
        return this.svc.getResources();
    }
};
exports.WellnessController = WellnessController;
__decorate([
    (0, common_1.Get)('counselor/slots'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WellnessController.prototype, "getSlots", null);
__decorate([
    (0, common_1.Get)('counselor/sessions/me'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WellnessController.prototype, "getMySessions", null);
__decorate([
    (0, common_1.Post)('counselor/sessions'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], WellnessController.prototype, "bookSession", null);
__decorate([
    (0, common_1.Get)('wellness/risk-score/:usn'),
    __param(0, (0, common_1.Param)('usn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WellnessController.prototype, "getRiskScore", null);
__decorate([
    (0, common_1.Get)('wellness/study-plan/me'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WellnessController.prototype, "getStudyPlan", null);
__decorate([
    (0, common_1.Patch)('wellness/study-plan/tasks/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WellnessController.prototype, "updateTask", null);
__decorate([
    (0, common_1.Get)('wellness/stress-resources'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WellnessController.prototype, "getResources", null);
exports.WellnessController = WellnessController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [wellness_service_1.WellnessService])
], WellnessController);
//# sourceMappingURL=wellness.controller.js.map