"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
let RolesService = class RolesService {
    constructor() {
        this.roles = [
            { name: 'ADMIN', permissions: ['*'] },
            { name: 'PRINCIPAL', permissions: ['reports:read', 'users:read', 'students:read'] },
            { name: 'DEAN', permissions: ['reports:read', 'students:read', 'faculty:read'] },
            { name: 'HOD', permissions: ['students:read', 'faculty:read', 'attendance:read'] },
            { name: 'FACULTY', permissions: ['students:read:section', 'attendance:write', 'marks:write'] },
            { name: 'COUNSELLOR', permissions: ['students:read', 'mentorship:write'] },
            { name: 'PARENT', permissions: ['students:read:linked', 'attendance:read:linked', 'fees:read:linked'] },
            { name: 'STUDENT', permissions: ['students:read:self', 'attendance:read:self', 'fees:read:self'] },
            { name: 'TRUSTEE', permissions: ['analytics:read', 'reports:read'] },
        ];
    }
    findAll() {
        return this.roles;
    }
    findByName(name) {
        return this.roles.find((r) => r.name === name);
    }
    hasPermission(role, permission) {
        const def = this.findByName(role);
        if (!def)
            return false;
        return def.permissions.includes('*') || def.permissions.includes(permission);
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)()
], RolesService);
//# sourceMappingURL=roles.service.js.map