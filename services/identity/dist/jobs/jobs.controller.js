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
exports.JobsController = void 0;
const common_1 = require("@nestjs/common");
const jobs_service_1 = require("./jobs.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let JobsController = class JobsController {
    constructor(svc) {
        this.svc = svc;
    }
    getJobs() {
        return this.svc.getJobs();
    }
    getMyApplications(req) {
        const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.getMyApplications(usn);
    }
    withdrawApplication(id) {
        return this.svc.withdraw(id);
    }
    getJob(id) {
        return this.svc.getJob(id);
    }
    apply(id, req) {
        const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.apply(id, usn);
    }
    getPredictions(dept, likelihood) {
        return this.svc.getPredictions(dept, likelihood);
    }
};
exports.JobsController = JobsController;
__decorate([
    (0, common_1.Get)('jobs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "getJobs", null);
__decorate([
    (0, common_1.Get)('jobs/applications/me'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "getMyApplications", null);
__decorate([
    (0, common_1.Patch)('jobs/applications/:applicationId/withdraw'),
    __param(0, (0, common_1.Param)('applicationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "withdrawApplication", null);
__decorate([
    (0, common_1.Get)('jobs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "getJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/apply'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "apply", null);
__decorate([
    (0, common_1.Get)('placements/predictions'),
    __param(0, (0, common_1.Query)('dept')),
    __param(1, (0, common_1.Query)('likelihood')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "getPredictions", null);
exports.JobsController = JobsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [jobs_service_1.JobsService])
], JobsController);
//# sourceMappingURL=jobs.controller.js.map