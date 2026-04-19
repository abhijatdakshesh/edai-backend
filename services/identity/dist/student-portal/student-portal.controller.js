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
exports.StudentPortalController = void 0;
const common_1 = require("@nestjs/common");
const student_portal_service_1 = require("./student-portal.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let StudentPortalController = class StudentPortalController {
    constructor(svc) {
        this.svc = svc;
    }
    getDashboard(req) {
        const usn = req.user?.usn ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.getDashboard(usn);
    }
    getSchedule(req) {
        const usn = req.user?.usn ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.getSchedule(usn);
    }
    getHostel(req) {
        const usn = req.user?.usn ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.getHostel(usn);
    }
    getExamPrep(req) {
        const usn = req.user?.usn ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.getExamPrep(usn);
    }
    getStaff() {
        return this.svc.getStaff();
    }
    getInstitutionStaff() {
        return this.svc.getStaff();
    }
};
exports.StudentPortalController = StudentPortalController;
__decorate([
    (0, common_1.Get)('student/dashboard'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StudentPortalController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('student/schedule'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StudentPortalController.prototype, "getSchedule", null);
__decorate([
    (0, common_1.Get)('student/hostel'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StudentPortalController.prototype, "getHostel", null);
__decorate([
    (0, common_1.Get)('student/exam-prep'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StudentPortalController.prototype, "getExamPrep", null);
__decorate([
    (0, common_1.Get)('student/hr'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StudentPortalController.prototype, "getStaff", null);
__decorate([
    (0, common_1.Get)('institution/staff'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StudentPortalController.prototype, "getInstitutionStaff", null);
exports.StudentPortalController = StudentPortalController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [student_portal_service_1.StudentPortalService])
], StudentPortalController);
//# sourceMappingURL=student-portal.controller.js.map