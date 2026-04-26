"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentsApiService = void 0;
const common_1 = require("@nestjs/common");
let AssignmentsApiService = class AssignmentsApiService {
    constructor() {
        this.assignments = [];
        this.submissions = [];
    }
    getStudentAssignments(usn) {
        return this.assignments
            .filter((a) => a.status === 'PUBLISHED')
            .map((a) => ({
            assignment: a,
            submission: this.submissions.find((s) => s.assignmentId === a.id && s.usn === usn),
        }));
    }
    getTeacherAssignments(teacherId) {
        return this.assignments
            .filter((a) => a.teacherId === teacherId)
            .map((a) => ({
            ...a,
            submissionCount: this.submissions.filter((s) => s.assignmentId === a.id && s.status !== 'PENDING').length,
        }));
    }
    createAssignment(data, teacherId) {
        const assignment = {
            id: `asn-${Date.now()}`,
            ...data,
            status: 'DRAFT',
            teacherId,
        };
        this.assignments.push(assignment);
        return assignment;
    }
    publishAssignment(id) {
        const assignment = this.assignments.find((a) => a.id === id);
        if (!assignment)
            throw new common_1.NotFoundException('Assignment not found');
        assignment.status = 'PUBLISHED';
        return assignment;
    }
    getSubmissions(assignmentId) {
        return this.submissions.filter((s) => s.assignmentId === assignmentId);
    }
    gradeSubmission(assignmentId, usn, marks, feedback) {
        const sub = this.submissions.find((s) => s.assignmentId === assignmentId && s.usn === usn);
        if (!sub)
            throw new common_1.NotFoundException('Submission not found');
        sub.marks = marks;
        sub.feedback = feedback;
        sub.status = 'GRADED';
        return sub;
    }
    getAllAssignments() {
        return this.assignments;
    }
    getAssignmentsByCourse(courseId) {
        return this.assignments.filter((a) => a.subjectCode === courseId);
    }
    getAssignmentById(id) {
        const a = this.assignments.find((a) => a.id === id);
        if (!a)
            throw new common_1.NotFoundException('Assignment not found');
        return a;
    }
    submitAssignment(id, usn, body) {
        const submissionId = `sub-${id}-${usn}-${Date.now()}`;
        const sub = {
            id: submissionId,
            assignmentId: id,
            usn,
            studentName: `Student ${usn}`,
            submittedAt: new Date().toISOString(),
            status: 'SUBMITTED',
        };
        this.submissions.push(sub);
        return { submissionId, submittedAt: sub.submittedAt, status: 'SUBMITTED' };
    }
    gradeSubmissionById(subId, marks, feedback) {
        const sub = this.submissions.find((s) => s.id === subId);
        if (sub) {
            sub.marks = marks;
            sub.feedback = feedback;
            sub.status = 'GRADED';
        }
        return { ok: true, submissionId: subId, marks, feedback };
    }
};
exports.AssignmentsApiService = AssignmentsApiService;
exports.AssignmentsApiService = AssignmentsApiService = __decorate([
    (0, common_1.Injectable)()
], AssignmentsApiService);
//# sourceMappingURL=assignments-api.service.js.map