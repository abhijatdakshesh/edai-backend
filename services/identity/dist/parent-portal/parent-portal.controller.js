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
exports.ParentPortalController = void 0;
const common_1 = require("@nestjs/common");
const parent_portal_service_1 = require("./parent-portal.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let ParentPortalController = class ParentPortalController {
    constructor(svc) {
        this.svc = svc;
    }
    getDashboard(req) {
        const parentId = req.user?.sub ?? 'unknown';
        return this.svc.getDashboard(parentId);
    }
    getChildren(req) {
        const parentId = req.user?.sub ?? 'unknown';
        return this.svc.getChildren(parentId);
    }
    getChildAttendance(usn) {
        return this.svc.getChildAttendance(usn);
    }
    getChildResults(usn) {
        return this.svc.getChildResults(usn);
    }
    getChildFees(usn) {
        return this.svc.getChildFees(usn);
    }
};
exports.ParentPortalController = ParentPortalController;
__decorate([
    (0, common_1.Get)('parent/dashboard'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ParentPortalController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('parent/children'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ParentPortalController.prototype, "getChildren", null);
__decorate([
    (0, common_1.Get)('parent/children/:usn/attendance'),
    __param(0, (0, common_1.Param)('usn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ParentPortalController.prototype, "getChildAttendance", null);
__decorate([
    (0, common_1.Get)('parent/children/:usn/results'),
    __param(0, (0, common_1.Param)('usn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ParentPortalController.prototype, "getChildResults", null);
__decorate([
    (0, common_1.Get)('parent/children/:usn/fees'),
    __param(0, (0, common_1.Param)('usn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ParentPortalController.prototype, "getChildFees", null);
exports.ParentPortalController = ParentPortalController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [parent_portal_service_1.ParentPortalService])
], ParentPortalController);
//# sourceMappingURL=parent-portal.controller.js.map