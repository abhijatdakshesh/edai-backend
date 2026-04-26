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
        this.classes = [
            { id: 'cls-1', name: 'CSE-A', departmentCode: 'CSE', semester: 5, section: 'A', strength: 60, classTeacherId: 'fac-1', classTeacherName: 'Dr. Sharma', subject: 'Data Structures', subjectCode: 'CS501', instructorId: 'fac-1', instructorName: 'Dr. Sharma', studentCount: 60 },
            { id: 'cls-2', name: 'CSE-B', departmentCode: 'CSE', semester: 5, section: 'B', strength: 58, classTeacherId: 'fac-2', classTeacherName: 'Dr. Reddy', subject: 'Algorithms', subjectCode: 'CS502', instructorId: 'fac-2', instructorName: 'Dr. Reddy', studentCount: 58 },
            { id: 'cls-3', name: 'ECE-A', departmentCode: 'ECE', semester: 3, section: 'A', strength: 55, classTeacherId: 'fac-3', classTeacherName: 'Dr. Patel', subject: 'Signals & Systems', subjectCode: 'EC301', instructorId: 'fac-3', instructorName: 'Dr. Patel', studentCount: 55 },
            { id: 'cls-4', name: 'ME-A', departmentCode: 'ME', semester: 3, section: 'A', strength: 45, classTeacherId: 'fac-4', classTeacherName: 'Dr. Kumar', subject: 'Thermodynamics', subjectCode: 'ME301', instructorId: 'fac-4', instructorName: 'Dr. Kumar', studentCount: 45 },
        ];
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
    getClassById(id) {
        const cls = this.classes.find((c) => c.id === id);
        if (!cls)
            throw new common_1.NotFoundException('Class not found');
        return cls;
    }
    getStudentsByClass(classId) {
        const roster = this.rosters.get(classId) ?? [];
        return roster.map((s) => ({
            usn: s.usn,
            name: s.name,
            attendancePct: Math.floor(70 + Math.random() * 25),
        }));
    }
};
exports.ClassesApiService = ClassesApiService;
exports.ClassesApiService = ClassesApiService = __decorate([
    (0, common_1.Injectable)()
], ClassesApiService);
//# sourceMappingURL=classes-api.service.js.map