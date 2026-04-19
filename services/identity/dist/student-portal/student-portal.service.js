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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentPortalService = void 0;
const common_1 = require("@nestjs/common");
const attendance_api_service_1 = require("../attendance-api/attendance-api.service");
const assignments_api_service_1 = require("../assignments-api/assignments-api.service");
const fees_api_service_1 = require("../fees-api/fees-api.service");
const courses_service_1 = require("../courses/courses.service");
let StudentPortalService = class StudentPortalService {
    constructor(attendanceSvc, assignmentsSvc, feesSvc, coursesSvc) {
        this.attendanceSvc = attendanceSvc;
        this.assignmentsSvc = assignmentsSvc;
        this.feesSvc = feesSvc;
        this.coursesSvc = coursesSvc;
        this.schedules = new Map();
        this.hostelData = new Map();
        this.staff = [];
    }
    getDashboard(usn) {
        let attendance = 0;
        let cgpa = 7.8;
        let pendingAssignments = 0;
        const activeAlerts = [];
        try {
            const attSummary = this.attendanceSvc.getStudentAttendance(usn);
            attendance = attSummary.overall;
            if (attendance < 75)
                activeAlerts.push('Attendance below 75%');
        }
        catch {
            attendance = 85;
        }
        try {
            const asnData = this.assignmentsSvc.getStudentAssignments(usn);
            pendingAssignments = asnData.filter((a) => !a.submission || a.submission.status === 'PENDING').length;
        }
        catch {
            pendingAssignments = 0;
        }
        try {
            const fees = this.feesSvc.getStudentFees(usn);
            if (fees.totalOutstanding > 0)
                activeAlerts.push('Fees outstanding');
        }
        catch {
        }
        const courses = this.coursesSvc.getCourses().slice(0, 4).map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
        }));
        const upcomingEvents = [
            { id: 'ev1', title: 'Mid-semester exams', date: '2026-05-10' },
            { id: 'ev2', title: 'Project submission', date: '2026-05-20' },
        ];
        return {
            attendance,
            cgpa,
            pendingAssignments,
            activeAlerts,
            courses,
            upcomingEvents,
        };
    }
    getSchedule(usn) {
        return { schedule: this.schedules.get(usn) ?? this.schedules.get('default') ?? [] };
    }
    getHostel(usn) {
        return (this.hostelData.get(usn) ??
            this.hostelData.get('default') ?? {
            hostel: {
                roomNumber: 'N/A',
                block: 'N/A',
                warden: 'N/A',
                messMenu: [],
            },
            transport: { route: 'N/A', pickupPoint: 'N/A', timing: 'N/A' },
        });
    }
    getExamPrep(usn) {
        return {
            stressLevel: 45,
            subjectReadiness: [
                { subject: 'Data Structures', readiness: 75, tip: 'Revise tree algorithms' },
                { subject: 'DBMS', readiness: 60, tip: 'Practice SQL queries' },
                { subject: 'Networks', readiness: 80, tip: 'Good progress, keep it up' },
            ],
            resources: [
                { title: 'Previous Year Papers', url: '/resources/pyq', type: 'pdf' },
                { title: 'Quick Revision Notes', url: '/resources/notes', type: 'article' },
            ],
        };
    }
    getStaff() {
        return this.staff;
    }
};
exports.StudentPortalService = StudentPortalService;
exports.StudentPortalService = StudentPortalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [attendance_api_service_1.AttendanceApiService,
        assignments_api_service_1.AssignmentsApiService,
        fees_api_service_1.FeesApiService,
        courses_service_1.CoursesService])
], StudentPortalService);
//# sourceMappingURL=student-portal.service.js.map