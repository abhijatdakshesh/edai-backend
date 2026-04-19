"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const node_crypto_1 = require("node:crypto");
const SEED_USERS = (() => {
    const h = (plain) => bcrypt.hashSync(plain, 10);
    return [
        {
            id: 'u-admin-01',
            email: 'admin@rvce.edu',
            passwordHash: h('Admin@123'),
            name: 'Admin User',
            role: 'ADMIN',
            institutionId: 'rvce',
            preferredLanguage: 'en',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'u-faculty-01',
            email: 'teacher@rvce.edu',
            passwordHash: h('Teacher@123'),
            name: 'Rajesh Kumar',
            role: 'FACULTY',
            institutionId: 'rvce',
            preferredLanguage: 'kn',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'u-student-01',
            email: 'student@rvce.edu',
            passwordHash: h('Student@123'),
            name: 'Priya Sharma',
            role: 'STUDENT',
            institutionId: 'rvce',
            sapId: '1RV21CS001',
            preferredLanguage: 'en',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'u-parent-01',
            email: 'parent@rvce.edu',
            passwordHash: h('Parent@123'),
            name: 'Suresh Sharma',
            role: 'PARENT',
            institutionId: 'rvce',
            preferredLanguage: 'kn',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'u-hod-01',
            email: 'hod@rvce.edu',
            passwordHash: h('Hod@123'),
            name: 'Dr. Anitha Rao',
            role: 'HOD',
            institutionId: 'rvce',
            preferredLanguage: 'en',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        {
            id: 'u-principal-01',
            email: 'principal@rvce.edu',
            passwordHash: h('Principal@123'),
            name: 'Dr. K. N. Subramanya',
            role: 'PRINCIPAL',
            institutionId: 'rvce',
            preferredLanguage: 'en',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    ];
})();
let AuthService = class AuthService {
    constructor(jwtService) {
        this.jwtService = jwtService;
        this.users = SEED_USERS;
        this.refreshStore = new Map();
    }
    async login(email, password) {
        const user = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        if (!passwordOk) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const tokens = this.issueTokens(user);
        const { passwordHash: _ph, ...safeUser } = user;
        return { ...tokens, user: safeUser };
    }
    refresh(incomingRefreshToken) {
        const userId = this.refreshStore.get(incomingRefreshToken);
        if (!userId) {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
        this.refreshStore.delete(incomingRefreshToken);
        const user = this.users.find((u) => u.id === userId);
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('User not found or inactive');
        }
        const { accessToken, refreshToken, expiresIn } = this.issueTokens(user);
        this.refreshStore.set(refreshToken, userId);
        return { accessToken, expiresIn };
    }
    logout(refreshToken) {
        this.refreshStore.delete(refreshToken);
        return { ok: true };
    }
    validatePayload(payload) {
        const user = this.users.find((u) => u.id === payload.sub && u.isActive);
        if (!user)
            return null;
        const { passwordHash: _ph, ...safe } = user;
        return safe;
    }
    issueTokens(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            institutionId: user.institutionId,
            preferredLanguage: user.preferredLanguage,
        };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = (0, node_crypto_1.randomBytes)(40).toString('hex');
        this.refreshStore.set(refreshToken, user.id);
        return { accessToken, refreshToken, expiresIn: 900 };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map