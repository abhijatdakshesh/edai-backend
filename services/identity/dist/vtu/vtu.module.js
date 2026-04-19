"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VtuModule = void 0;
const common_1 = require("@nestjs/common");
const vtu_controller_1 = require("./vtu.controller");
const vtu_service_1 = require("./vtu.service");
const events_module_1 = require("../events/events.module");
let VtuModule = class VtuModule {
};
exports.VtuModule = VtuModule;
exports.VtuModule = VtuModule = __decorate([
    (0, common_1.Module)({
        imports: [events_module_1.EventsModule],
        controllers: [vtu_controller_1.VtuController],
        providers: [vtu_service_1.VtuService],
        exports: [vtu_service_1.VtuService],
    })
], VtuModule);
//# sourceMappingURL=vtu.module.js.map