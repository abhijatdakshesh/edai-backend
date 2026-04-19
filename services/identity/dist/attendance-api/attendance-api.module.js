"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceApiModule = void 0;
const common_1 = require("@nestjs/common");
const attendance_api_controller_1 = require("./attendance-api.controller");
const attendance_api_service_1 = require("./attendance-api.service");
const events_module_1 = require("../events/events.module");
let AttendanceApiModule = class AttendanceApiModule {
};
exports.AttendanceApiModule = AttendanceApiModule;
exports.AttendanceApiModule = AttendanceApiModule = __decorate([
    (0, common_1.Module)({
        imports: [events_module_1.EventsModule],
        controllers: [attendance_api_controller_1.AttendanceApiController],
        providers: [attendance_api_service_1.AttendanceApiService],
        exports: [attendance_api_service_1.AttendanceApiService],
    })
], AttendanceApiModule);
//# sourceMappingURL=attendance-api.module.js.map