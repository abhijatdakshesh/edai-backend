"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentPortalModule = void 0;
const common_1 = require("@nestjs/common");
const student_portal_controller_1 = require("./student-portal.controller");
const student_portal_service_1 = require("./student-portal.service");
const attendance_api_module_1 = require("../attendance-api/attendance-api.module");
const assignments_api_module_1 = require("../assignments-api/assignments-api.module");
const fees_api_module_1 = require("../fees-api/fees-api.module");
const courses_module_1 = require("../courses/courses.module");
let StudentPortalModule = class StudentPortalModule {
};
exports.StudentPortalModule = StudentPortalModule;
exports.StudentPortalModule = StudentPortalModule = __decorate([
    (0, common_1.Module)({
        imports: [attendance_api_module_1.AttendanceApiModule, assignments_api_module_1.AssignmentsApiModule, fees_api_module_1.FeesApiModule, courses_module_1.CoursesModule],
        controllers: [student_portal_controller_1.StudentPortalController],
        providers: [student_portal_service_1.StudentPortalService],
        exports: [student_portal_service_1.StudentPortalService],
    })
], StudentPortalModule);
//# sourceMappingURL=student-portal.module.js.map