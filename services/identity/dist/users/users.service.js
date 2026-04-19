"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const node_crypto_1 = require("node:crypto");
let UsersService = class UsersService {
    constructor() {
        this.store = [
            this.seed('u-admin-01', 'Admin User', 'admin@rvce.edu', 'Admin@123', 'ADMIN', 'en'),
            this.seed('u-hod-01', 'Dr. Suresh Babu', 'hod.cse@rvce.edu', 'Hod@123', 'HOD', 'kn', 'CSE'),
            this.seed('u-faculty-01', 'Rajesh Kumar', 'teacher@rvce.edu', 'Teacher@123', 'FACULTY', 'kn', 'CSE'),
            this.seed('u-faculty-02', 'Preethi Nair', 'preethi@rvce.edu', 'Teacher@123', 'FACULTY', 'en', 'ECE'),
            this.seed('u-faculty-03', 'Mohan Das', 'mohan@rvce.edu', 'Teacher@123', 'FACULTY', 'kn', 'ME'),
            this.seed('u-student-01', 'Priya Sharma', 'student@rvce.edu', 'Student@123', 'STUDENT', 'en', 'CSE', '1RV21CS001'),
            this.seed('u-student-02', 'Arjun Reddy', 'arjun@rvce.edu', 'Student@123', 'STUDENT', 'en', 'CSE', '1RV21CS002'),
            this.seed('u-student-03', 'Kavya Gowda', 'kavya@rvce.edu', 'Student@123', 'STUDENT', 'kn', 'ECE', '1RV21EC001'),
            this.seed('u-parent-01', 'Ramesh Sharma', 'parent@rvce.edu', 'Parent@123', 'PARENT', 'en'),
            this.seed('u-counsellor-01', 'Dr. Anitha Rao', 'counsellor@rvce.edu', 'Counsellor@123', 'COUNSELLOR', 'en'),
        ];
    }
    seed(id, name, email, password, role, lang, dept, sapId) {
        return {
            id,
            name,
            email,
            passwordHash: bcrypt.hashSync(password, 10),
            role,
            institutionId: 'rvce',
            preferredLanguage: lang,
            isActive: true,
            sapId,
            departmentCode: dept,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }
    safe(user) {
        const { passwordHash: _, ...rest } = user;
        return rest;
    }
    findAll(filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        let results = [...this.store];
        if (filters.role) {
            results = results.filter((u) => u.role.toLowerCase() === filters.role.toLowerCase());
        }
        if (filters.status === 'active') {
            results = results.filter((u) => u.isActive);
        }
        else if (filters.status === 'inactive') {
            results = results.filter((u) => !u.isActive);
        }
        if (filters.search) {
            const q = filters.search.toLowerCase();
            results = results.filter((u) => u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.sapId ?? '').toLowerCase().includes(q));
        }
        const total = results.length;
        const data = results
            .slice((page - 1) * limit, page * limit)
            .map((u) => this.safe(u));
        return { data, total, page, limit };
    }
    findMe(userId) {
        const user = this.store.find((u) => u.id === userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return this.safe(user);
    }
    findById(id) {
        const user = this.store.find((u) => u.id === id);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return this.safe(user);
    }
    findByEmail(email) {
        return this.store.find((u) => u.email === email);
    }
    create(dto) {
        if (this.store.find((u) => u.email === dto.email)) {
            throw new common_1.BadRequestException('Email already in use');
        }
        const user = {
            id: (0, node_crypto_1.randomUUID)(),
            name: dto.name,
            email: dto.email,
            passwordHash: bcrypt.hashSync(dto.password, 10),
            role: dto.role,
            institutionId: dto.institutionId,
            preferredLanguage: dto.preferredLanguage ?? 'en',
            sapId: dto.sapId,
            departmentCode: dto.departmentCode,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this.store.push(user);
        return this.safe(user);
    }
    update(id, dto) {
        const idx = this.store.findIndex((u) => u.id === id);
        if (idx === -1)
            throw new common_1.NotFoundException('User not found');
        const user = this.store[idx];
        this.store[idx] = {
            ...user,
            ...(dto.name && { name: dto.name }),
            ...(dto.email && { email: dto.email }),
            ...(dto.role && { role: dto.role }),
            ...(dto.sapId !== undefined && { sapId: dto.sapId }),
            ...(dto.departmentCode !== undefined && { departmentCode: dto.departmentCode }),
            ...(dto.preferredLanguage && { preferredLanguage: dto.preferredLanguage }),
            updatedAt: new Date().toISOString(),
        };
        return this.safe(this.store[idx]);
    }
    setStatus(id, isActive) {
        const idx = this.store.findIndex((u) => u.id === id);
        if (idx === -1)
            throw new common_1.NotFoundException('User not found');
        this.store[idx] = {
            ...this.store[idx],
            isActive,
            updatedAt: new Date().toISOString(),
        };
        return this.safe(this.store[idx]);
    }
    resetPassword(id) {
        const idx = this.store.findIndex((u) => u.id === id);
        if (idx === -1)
            throw new common_1.NotFoundException('User not found');
        const tempPassword = `Temp${Math.random().toString(36).slice(2, 8)}!`;
        this.store[idx] = {
            ...this.store[idx],
            passwordHash: bcrypt.hashSync(tempPassword, 10),
            updatedAt: new Date().toISOString(),
        };
        return { tempPassword };
    }
    exportCsv() {
        const header = 'id,name,email,role,sapId,departmentCode,isActive,createdAt';
        const rows = this.store.map((u) => [u.id, u.name, u.email, u.role, u.sapId ?? '', u.departmentCode ?? '', u.isActive, u.createdAt].join(','));
        return [header, ...rows].join('\n');
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)()
], UsersService);
//# sourceMappingURL=users.service.js.map