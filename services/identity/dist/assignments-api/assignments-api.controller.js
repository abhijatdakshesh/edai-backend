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
exports.AssignmentsApiController = void 0;
const common_1 = require("@nestjs/common");
const assignments_api_service_1 = require("./assignments-api.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const events_gateway_1 = require("../events/events.gateway");
let AssignmentsApiController = class AssignmentsApiController {
    constructor(svc, events) {
        this.svc = svc;
        this.events = events;
    }
    getStudentAssignments(req) {
        const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.getStudentAssignments(usn);
    }
    getTeacherAssignments(req) {
        const teacherId = req.user?.sub ?? 'unknown';
        return this.svc.getTeacherAssignments(teacherId);
    }
    createAssignment(body, req) {
        const teacherId = req.user?.sub ?? 'unknown';
        return this.svc.createAssignment(body, teacherId);
    }
    publishAssignment(id) {
        return this.svc.publishAssignment(id);
    }
    getSubmissions(id) {
        return this.svc.getSubmissions(id);
    }
    gradeSubmission(id, usn, body) {
        const result = this.svc.gradeSubmission(id, usn, body.marks, body.feedback);
        this.events.emitMarksUpdate({ subjectCode: result.assignmentId, sem: 0 });
        return result;
    }
    getAllAssignments() {
        return this.svc.getAllAssignments();
    }
    getAssignmentsByCourse(courseId) {
        return this.svc.getAssignmentsByCourse(courseId);
    }
    getStudentAssignmentsByUsn(usn) {
        return this.svc.getStudentAssignments(usn);
    }
    getAssignmentDetail(id) {
        return this.svc.getAssignmentById(id);
    }
    getSubmissionsById(id) {
        return this.svc.getSubmissions(id);
    }
    submitAssignment(id, body, req) {
        const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
        return this.svc.submitAssignment(id, usn, body);
    }
    gradeSubmissionById(subId, body) {
        return this.svc.gradeSubmissionById(subId, body.marks, body.feedback);
    }
};
exports.AssignmentsApiController = AssignmentsApiController;
__decorate([
    (0, common_1.Get)('student/assignments'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "getStudentAssignments", null);
__decorate([
    (0, common_1.Get)('teacher/assignments'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "getTeacherAssignments", null);
__decorate([
    (0, common_1.Post)('teacher/assignments'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "createAssignment", null);
__decorate([
    (0, common_1.Patch)('teacher/assignments/:id/publish'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "publishAssignment", null);
__decorate([
    (0, common_1.Get)('teacher/assignments/:id/submissions'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "getSubmissions", null);
__decorate([
    (0, common_1.Post)('teacher/assignments/:id/submissions/:usn/grade'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('usn')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "gradeSubmission", null);
__decorate([
    (0, common_1.Get)('assignments'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "getAllAssignments", null);
__decorate([
    (0, common_1.Get)('assignments/course/:courseId'),
    __param(0, (0, common_1.Param)('courseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "getAssignmentsByCourse", null);
__decorate([
    (0, common_1.Get)('assignments/student/:usn'),
    __param(0, (0, common_1.Param)('usn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "getStudentAssignmentsByUsn", null);
__decorate([
    (0, common_1.Get)('teacher/assignments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "getAssignmentDetail", null);
__decorate([
    (0, common_1.Get)('assignments/:id/submissions'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "getSubmissionsById", null);
__decorate([
    (0, common_1.Post)('assignments/:id/submit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "submitAssignment", null);
__decorate([
    (0, common_1.Post)('assignments/submissions/:submissionId/grade'),
    __param(0, (0, common_1.Param)('submissionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AssignmentsApiController.prototype, "gradeSubmissionById", null);
exports.AssignmentsApiController = AssignmentsApiController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [assignments_api_service_1.AssignmentsApiService,
        events_gateway_1.EventsGateway])
], AssignmentsApiController);
//# sourceMappingURL=assignments-api.controller.js.map