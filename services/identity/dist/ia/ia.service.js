"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IaService = void 0;
const common_1 = require("@nestjs/common");
let IaService = class IaService {
    constructor() {
        this.entries = [];
        this.submissions = [];
    }
    getMarks(subjectCode, sem) {
        return this.entries.filter((e) => e.subjectCode === subjectCode && e.sem === sem);
    }
    saveMarks(subjectCode, sem, marks, teacherId) {
        for (const m of marks) {
            const existing = this.entries.find((e) => e.usn === m.usn && e.subjectCode === subjectCode && e.sem === sem);
            if (existing) {
                existing.ia1 = m.ia1;
                existing.ia2 = m.ia2;
                existing.ia3 = m.ia3;
            }
            else {
                this.entries.push({
                    usn: m.usn,
                    name: `Student ${m.usn}`,
                    subjectCode,
                    sem,
                    ia1: m.ia1,
                    ia2: m.ia2,
                    ia3: m.ia3,
                });
            }
        }
        const existing = this.submissions.find((s) => s.teacherId === teacherId &&
            s.subjectCode === subjectCode &&
            s.sem === sem);
        if (existing) {
            existing.submittedAt = new Date().toISOString();
            return existing;
        }
        const sub = {
            id: `ia-sub-${Date.now()}`,
            teacherId,
            subjectCode,
            sem,
            submittedAt: new Date().toISOString(),
            status: 'DRAFT',
        };
        this.submissions.push(sub);
        return sub;
    }
    submitForReview(subjectCode, sem, teacherId) {
        const sub = this.submissions.find((s) => s.teacherId === teacherId &&
            s.subjectCode === subjectCode &&
            s.sem === sem);
        if (!sub)
            throw new common_1.NotFoundException('Submission not found');
        sub.status = 'SUBMITTED';
        sub.submittedAt = new Date().toISOString();
        return sub;
    }
    getAllSubmissions() {
        return this.submissions;
    }
    confirm(id) {
        const sub = this.submissions.find((s) => s.id === id);
        if (!sub)
            throw new common_1.NotFoundException('Submission not found');
        sub.status = 'CONFIRMED';
        return sub;
    }
    sendReminders(teacherIds) {
        return { reminded: teacherIds };
    }
    uploadResults(subjectCode, sem) {
        return { message: `Results for ${subjectCode} sem ${sem} queued for upload` };
    }
};
exports.IaService = IaService;
exports.IaService = IaService = __decorate([
    (0, common_1.Injectable)()
], IaService);
//# sourceMappingURL=ia.service.js.map