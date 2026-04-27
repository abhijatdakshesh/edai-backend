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
exports.AttendanceApiController = void 0;
const common_1 = require("@nestjs/common");
const attendance_api_service_1 = require("./attendance-api.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const events_gateway_1 = require("../events/events.gateway");
let AttendanceApiController = class AttendanceApiController {
    constructor(svc, events) {
        this.svc = svc;
        this.events = events;
    }
    getStudentAttendanceSummary(usn) {
        return this.svc.getStudentAttendanceSummary(usn);
    }
    getStudentAttendance(usn) {
        return this.svc.getStudentAttendance(usn);
    }
    getClassAttendanceSummary(classId) {
        return this.svc.getClassAttendanceSummary(classId);
    }
    getAtRiskStudents(classId) {
        return this.svc.getAtRiskStudents(classId);
    }
    markBulkAlt(body, req) {
        const markedBy = req.user?.sub ?? 'unknown';
        const mapped = body.entries.map((e) => ({
            usn: e.studentUsn,
            status: (e.status === 'PRESENT' ? 'P' : e.status === 'LATE' ? 'L' : 'A'),
        }));
        const result = this.svc.markBulk(body.classId, body.date, mapped, markedBy);
        this.events.emitAttendanceUpdate({ classId: body.classId, date: body.date });
        return result;
    }
    markBulk(body, req) {
        const markedBy = req.user?.sub ?? 'unknown';
        const result = this.svc.markBulk(body.classId, body.date, body.records, markedBy);
        this.events.emitAttendanceUpdate({ classId: body.classId, date: body.date });
        return result;
    }
    getTeacherSummary(req) {
        const teacherId = req.user?.sub ?? 'unknown';
        return this.svc.getTeacherSummary(teacherId);
    }
    getClassStudents(id) {
        return this.svc.getClassStudents(id);
    }
    getAuditLog() {
        return this.svc.getAuditLog();
    }
    correctRecord(id, body, req) {
        const editedBy = req.user?.sub ?? 'unknown';
        return this.svc.correctRecord(id, body.status, editedBy);
    }
};
exports.AttendanceApiController = AttendanceApiController;
__decorate([
    (0, common_1.Get)('attendance/student/:usn/summary'),
    __param(0, (0, common_1.Param)('usn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AttendanceApiController.prototype, "getStudentAttendanceSummary", null);
__decorate([
    (0, common_1.Get)('attendance/student/:usn'),
    __param(0, (0, common_1.Param)('usn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AttendanceApiController.prototype, "getStudentAttendance", null);
__decorate([
    (0, common_1.Get)('attendance/class/:classId/summary'),
    __param(0, (0, common_1.Param)('classId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AttendanceApiController.prototype, "getClassAttendanceSummary", null);
__decorate([
    (0, common_1.Get)('attendance/class/:classId/at-risk'),
    __param(0, (0, common_1.Param)('classId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AttendanceApiController.prototype, "getAtRiskStudents", null);
__decorate([
    (0, common_1.Post)('attendance/bulk'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AttendanceApiController.prototype, "markBulkAlt", null);
__decorate([
    (0, common_1.Post)('attendance'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AttendanceApiController.prototype, "markBulk", null);
__decorate([
    (0, common_1.Get)('teacher/attendance/summary'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AttendanceApiController.prototype, "getTeacherSummary", null);
__decorate([
    (0, common_1.Get)('teacher/classes/:id/students'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AttendanceApiController.prototype, "getClassStudents", null);
__decorate([
    (0, common_1.Get)('admin/attendance/audit'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AttendanceApiController.prototype, "getAuditLog", null);
__decorate([
    (0, common_1.Put)('admin/attendance/audit/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], AttendanceApiController.prototype, "correctRecord", null);
exports.AttendanceApiController = AttendanceApiController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [attendance_api_service_1.AttendanceApiService,
        events_gateway_1.EventsGateway])
], AttendanceApiController);
//# sourceMappingURL=attendance-api.controller.js.map