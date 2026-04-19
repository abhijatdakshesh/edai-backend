"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminPortalModule = void 0;
const common_1 = require("@nestjs/common");
const admin_portal_controller_1 = require("./admin-portal.controller");
const admin_portal_service_1 = require("./admin-portal.service");
const fees_api_module_1 = require("../fees-api/fees-api.module");
let AdminPortalModule = class AdminPortalModule {
};
exports.AdminPortalModule = AdminPortalModule;
exports.AdminPortalModule = AdminPortalModule = __decorate([
    (0, common_1.Module)({
        imports: [fees_api_module_1.FeesApiModule],
        controllers: [admin_portal_controller_1.AdminPortalController],
        providers: [admin_portal_service_1.AdminPortalService],
        exports: [admin_portal_service_1.AdminPortalService],
    })
], AdminPortalModule);
//# sourceMappingURL=admin-portal.module.js.map