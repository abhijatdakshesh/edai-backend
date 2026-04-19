"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoursesService = void 0;
const common_1 = require("@nestjs/common");
let CoursesService = class CoursesService {
    constructor() {
        this.courses = [];
        this.enrollments = [];
        this.academicResults = [];
    }
    getCourses() {
        return this.courses;
    }
    enroll(courseId, studentUsn) {
        const course = this.courses.find((c) => c.id === courseId);
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        const existing = this.enrollments.find((e) => e.courseId === courseId && e.studentUsn === studentUsn);
        if (!existing) {
            this.enrollments.push({ courseId, studentUsn });
            course.enrolled++;
        }
        return { message: 'Enrolled successfully' };
    }
    unenroll(courseId, studentUsn) {
        const idx = this.enrollments.findIndex((e) => e.courseId === courseId && e.studentUsn === studentUsn);
        if (idx !== -1) {
            this.enrollments.splice(idx, 1);
            const course = this.courses.find((c) => c.id === courseId);
            if (course && course.enrolled > 0)
                course.enrolled--;
        }
        return { message: 'Unenrolled successfully' };
    }
    getResults(usn) {
        const result = this.academicResults.find((r) => r.usn === usn);
        if (!result)
            throw new common_1.NotFoundException('Results not found for USN');
        return result;
    }
};
exports.CoursesService = CoursesService;
exports.CoursesService = CoursesService = __decorate([
    (0, common_1.Injectable)()
], CoursesService);
//# sourceMappingURL=courses.service.js.map