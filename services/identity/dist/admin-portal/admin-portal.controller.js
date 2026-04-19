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
const admin_portal_service_1 = require("./admin-portal.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
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
    getNaac() {
        return this.svc.getNaac();
    }
    triggerBulkImport(body) {
        return this.svc.triggerBulkImport(body.entityType, body.fileUrl);
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
    (0, common_1.Get)('admin/naac'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "getNaac", null);
__decorate([
    (0, common_1.Post)('admin/bulk-import/trigger'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminPortalController.prototype, "triggerBulkImport", null);
exports.AdminPortalController = AdminPortalController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [admin_portal_service_1.AdminPortalService])
], AdminPortalController);
//# sourceMappingURL=admin-portal.controller.js.map