"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentsApiModule = void 0;
const common_1 = require("@nestjs/common");
const assignments_api_controller_1 = require("./assignments-api.controller");
const assignments_api_service_1 = require("./assignments-api.service");
const events_module_1 = require("../events/events.module");
let AssignmentsApiModule = class AssignmentsApiModule {
};
exports.AssignmentsApiModule = AssignmentsApiModule;
exports.AssignmentsApiModule = AssignmentsApiModule = __decorate([
    (0, common_1.Module)({
        imports: [events_module_1.EventsModule],
        controllers: [assignments_api_controller_1.AssignmentsApiController],
        providers: [assignments_api_service_1.AssignmentsApiService],
        exports: [assignments_api_service_1.AssignmentsApiService],
    })
], AssignmentsApiModule);
//# sourceMappingURL=assignments-api.module.js.map