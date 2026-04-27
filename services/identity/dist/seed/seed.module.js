"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedModule = void 0;
const common_1 = require("@nestjs/common");
const seed_service_1 = require("./seed.service");
const courses_module_1 = require("../courses/courses.module");
const attendance_api_module_1 = require("../attendance-api/attendance-api.module");
const assignments_api_module_1 = require("../assignments-api/assignments-api.module");
const ia_module_1 = require("../ia/ia.module");
const fees_api_module_1 = require("../fees-api/fees-api.module");
const vtu_module_1 = require("../vtu/vtu.module");
const wellness_module_1 = require("../wellness/wellness.module");
const jobs_module_1 = require("../jobs/jobs.module");
const classes_api_module_1 = require("../classes-api/classes-api.module");
const student_portal_module_1 = require("../student-portal/student-portal.module");
const parent_portal_module_1 = require("../parent-portal/parent-portal.module");
const comms_module_1 = require("../comms/comms.module");
const admin_portal_module_1 = require("../admin-portal/admin-portal.module");
let SeedModule = class SeedModule {
};
exports.SeedModule = SeedModule;
exports.SeedModule = SeedModule = __decorate([
    (0, common_1.Module)({
        imports: [
            courses_module_1.CoursesModule,
            attendance_api_module_1.AttendanceApiModule,
            assignments_api_module_1.AssignmentsApiModule,
            ia_module_1.IaModule,
            fees_api_module_1.FeesApiModule,
            vtu_module_1.VtuModule,
            wellness_module_1.WellnessModule,
            jobs_module_1.JobsModule,
            classes_api_module_1.ClassesApiModule,
            student_portal_module_1.StudentPortalModule,
            parent_portal_module_1.ParentPortalModule,
            comms_module_1.CommsModule,
            admin_portal_module_1.AdminPortalModule,
        ],
        providers: [seed_service_1.SeedService],
    })
], SeedModule);
//# sourceMappingURL=seed.module.js.map