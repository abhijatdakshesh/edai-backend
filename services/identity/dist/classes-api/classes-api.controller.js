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
exports.ClassesApiController = void 0;
const common_1 = require("@nestjs/common");
const classes_api_service_1 = require("./classes-api.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let ClassesApiController = class ClassesApiController {
    constructor(svc) {
        this.svc = svc;
    }
    getTeacherClasses(req) {
        const teacherId = req.user?.sub ?? 'unknown';
        return this.svc.getTeacherClasses(teacherId);
    }
    getTeacherDashboard(req) {
        const teacherId = req.user?.sub ?? 'unknown';
        return this.svc.getTeacherDashboard(teacherId);
    }
    getAllClasses() {
        return this.svc.getAllClasses();
    }
};
exports.ClassesApiController = ClassesApiController;
__decorate([
    (0, common_1.Get)('teacher/classes'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassesApiController.prototype, "getTeacherClasses", null);
__decorate([
    (0, common_1.Get)('teacher/dashboard'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassesApiController.prototype, "getTeacherDashboard", null);
__decorate([
    (0, common_1.Get)('classes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClassesApiController.prototype, "getAllClasses", null);
exports.ClassesApiController = ClassesApiController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [classes_api_service_1.ClassesApiService])
], ClassesApiController);
//# sourceMappingURL=classes-api.controller.js.map