"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const roles_module_1 = require("./roles/roles.module");
const parents_module_1 = require("./parents/parents.module");
const students_module_1 = require("./students/students.module");
const directory_module_1 = require("./directory/directory.module");
const health_module_1 = require("./health/health.module");
const roles_guard_1 = require("./roles/roles.guard");
const events_module_1 = require("./events/events.module");
const courses_module_1 = require("./courses/courses.module");
const attendance_api_module_1 = require("./attendance-api/attendance-api.module");
const assignments_api_module_1 = require("./assignments-api/assignments-api.module");
const ia_module_1 = require("./ia/ia.module");
const fees_api_module_1 = require("./fees-api/fees-api.module");
const vtu_module_1 = require("./vtu/vtu.module");
const wellness_module_1 = require("./wellness/wellness.module");
const jobs_module_1 = require("./jobs/jobs.module");
const classes_api_module_1 = require("./classes-api/classes-api.module");
const student_portal_module_1 = require("./student-portal/student-portal.module");
const parent_portal_module_1 = require("./parent-portal/parent-portal.module");
const admin_portal_module_1 = require("./admin-portal/admin-portal.module");
const comms_module_1 = require("./comms/comms.module");
const departments_module_1 = require("./departments/departments.module");
const seed_module_1 = require("./seed/seed.module");
const promotion_module_1 = require("./promotion/promotion.module");
const chatbot_module_1 = require("./chatbot/chatbot.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            roles_module_1.RolesModule,
            students_module_1.StudentsModule,
            parents_module_1.ParentsModule,
            directory_module_1.DirectoryModule,
            health_module_1.HealthModule,
            events_module_1.EventsModule,
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
            admin_portal_module_1.AdminPortalModule,
            comms_module_1.CommsModule,
            departments_module_1.DepartmentsModule,
            promotion_module_1.PromotionModule,
            chatbot_module_1.ChatbotModule,
            seed_module_1.SeedModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: roles_guard_1.RolesGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map