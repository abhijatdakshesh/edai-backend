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
exports.ParentPortalService = void 0;
const common_1 = require("@nestjs/common");
const attendance_api_service_1 = require("../attendance-api/attendance-api.service");
const fees_api_service_1 = require("../fees-api/fees-api.service");
const courses_service_1 = require("../courses/courses.service");
let ParentPortalService = class ParentPortalService {
    constructor(attendanceSvc, feesSvc, coursesSvc) {
        this.attendanceSvc = attendanceSvc;
        this.feesSvc = feesSvc;
        this.coursesSvc = coursesSvc;
        this.parentChildMap = new Map();
        this.childProfiles = new Map();
    }
    getChildren(parentId) {
        const usns = this.parentChildMap.get(parentId) ?? ['1RV21CS001'];
        return usns.map((usn) => this.childProfiles.get(usn) ?? {
            usn,
            name: `Student ${usn}`,
            semester: 5,
            dept: 'Computer Science',
            cgpa: 7.5,
            attendance: 80,
        });
    }
    getDashboard(parentId) {
        const children = this.getChildren(parentId);
        let pendingFees = 0;
        for (const child of children) {
            try {
                const fees = this.feesSvc.getStudentFees(child.usn);
                pendingFees += fees.totalOutstanding;
            }
            catch {
            }
        }
        return {
            children,
            pendingFees,
            recentNotifications: [
                {
                    id: 'notif-1',
                    message: 'Your child was absent on 17-Apr',
                    sentAt: new Date().toISOString(),
                },
            ],
        };
    }
    getChildAttendance(usn) {
        try {
            return this.attendanceSvc.getStudentAttendance(usn);
        }
        catch {
            return { overall: 80, subjects: [] };
        }
    }
    getChildResults(usn) {
        try {
            return this.coursesSvc.getResults(usn);
        }
        catch {
            return { usn, cgpa: 7.5, semesters: [] };
        }
    }
    getChildFees(usn) {
        try {
            return this.feesSvc.getStudentFees(usn);
        }
        catch {
            return { totalDue: 0, totalOutstanding: 0, items: [] };
        }
    }
};
exports.ParentPortalService = ParentPortalService;
exports.ParentPortalService = ParentPortalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [attendance_api_service_1.AttendanceApiService,
        fees_api_service_1.FeesApiService,
        courses_service_1.CoursesService])
], ParentPortalService);
//# sourceMappingURL=parent-portal.service.js.map