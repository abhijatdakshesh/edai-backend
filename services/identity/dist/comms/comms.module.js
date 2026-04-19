"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommsModule = void 0;
const common_1 = require("@nestjs/common");
const comms_controller_1 = require("./comms.controller");
const comms_service_1 = require("./comms.service");
const events_module_1 = require("../events/events.module");
const student_portal_module_1 = require("../student-portal/student-portal.module");
let CommsModule = class CommsModule {
};
exports.CommsModule = CommsModule;
exports.CommsModule = CommsModule = __decorate([
    (0, common_1.Module)({
        imports: [events_module_1.EventsModule, student_portal_module_1.StudentPortalModule],
        controllers: [comms_controller_1.CommsController],
        providers: [comms_service_1.CommsService],
        exports: [comms_service_1.CommsService],
    })
], CommsModule);
//# sourceMappingURL=comms.module.js.map