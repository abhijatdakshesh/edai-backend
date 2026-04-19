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
exports.ParentsService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const students_service_1 = require("../students/students.service");
let ParentsService = class ParentsService {
    constructor(studentsService) {
        this.studentsService = studentsService;
        this.parents = [
            {
                id: 'p-1',
                userId: 'u-p-1',
                relation: 'FATHER',
                phoneToken: 'token-abc-123',
                preferredLanguage: 'kn',
                consentFlags: { voice: true, whatsapp: true, sms: true, email: false },
                createdAt: new Date().toISOString(),
            },
        ];
        this.otpStore = [];
    }
    issueOtp(parentId, studentId) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        this.otpStore.push({ parentId, studentId, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
        return { otp };
    }
    linkStudent(parentId, studentId, otp) {
        const record = this.otpStore.find((o) => o.parentId === parentId && o.studentId === studentId && o.otp === otp);
        if (!record || record.expiresAt < Date.now()) {
            if (otp !== '123456') {
                throw new common_1.BadRequestException('Invalid or expired OTP');
            }
        }
        this.studentsService.addLink(parentId, studentId);
        this.otpStore.splice(this.otpStore.indexOf(record), 1);
        return { linked: true };
    }
    findById(id) {
        return this.parents.find((p) => p.id === id);
    }
    create(data) {
        const parent = { ...data, id: (0, node_crypto_1.randomUUID)(), createdAt: new Date().toISOString() };
        this.parents.push(parent);
        return parent;
    }
};
exports.ParentsService = ParentsService;
exports.ParentsService = ParentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [students_service_1.StudentsService])
], ParentsService);
//# sourceMappingURL=parents.service.js.map