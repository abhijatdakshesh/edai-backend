"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassesApiService = void 0;
const common_1 = require("@nestjs/common");
let ClassesApiService = class ClassesApiService {
    constructor() {
        this.classes = [];
        this.rosters = new Map();
    }
    getTeacherClasses(teacherId) {
        return this.classes.filter((c) => c.instructorId === teacherId);
    }
    getAllClasses() {
        return this.classes;
    }
    getTeacherDashboard(teacherId) {
        const teacherClasses = this.getTeacherClasses(teacherId);
        const totalStudents = teacherClasses.reduce((sum, c) => sum + c.studentCount, 0);
        return {
            totalStudents,
            atRiskCount: Math.floor(totalStudents * 0.1),
            classesToday: Math.min(teacherClasses.length, 3),
            pendingMarksEntry: 2,
            atRiskStudents: [
                { usn: '1RV21CS003', name: 'Priya Sharma', risk: 'HIGH' },
                { usn: '1RV21CS005', name: 'Ravi Kumar', risk: 'MEDIUM' },
            ],
        };
    }
    getClassStudents(classId) {
        return this.rosters.get(classId) ?? [];
    }
};
exports.ClassesApiService = ClassesApiService;
exports.ClassesApiService = ClassesApiService = __decorate([
    (0, common_1.Injectable)()
], ClassesApiService);
//# sourceMappingURL=classes-api.service.js.map