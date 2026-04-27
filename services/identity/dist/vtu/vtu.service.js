"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VtuService = void 0;
const common_1 = require("@nestjs/common");
let VtuService = class VtuService {
    constructor() {
        this.windows = [];
        this.registrations = [];
        this.eligibilities = [];
    }
    getAllWindows() {
        return this.windows;
    }
    getActiveWindow() {
        return this.windows.find((w) => w.isActive) ?? null;
    }
    createWindow(data) {
        const win = {
            id: `vtu-win-${Date.now()}`,
            subjectCodes: data.subjectCodes ?? [],
            ...data,
            isActive: true,
        };
        this.windows.forEach((w) => (w.isActive = false));
        this.windows.push(win);
        return win;
    }
    getStudentStatus(usn, windowId) {
        const win = this.windows.find((w) => w.id === windowId);
        const elig = this.eligibilities.find((e) => e.windowId === windowId && e.usn === usn);
        const reg = this.registrations.find((r) => r.windowId === windowId && r.usn === usn);
        const allSubjects = win?.subjectCodes ?? [];
        const eligibleSubjects = elig?.eligibleSubjects ?? [];
        const ineligibleSubjects = allSubjects.filter((code) => !eligibleSubjects.includes(code));
        return {
            status: reg ? 'REGISTERED' : elig?.isEligible ? 'ELIGIBLE' : 'INELIGIBLE',
            eligibleSubjects,
            ineligibleSubjects,
            registeredSubjects: reg?.subjectCodes ?? [],
        };
    }
    registerStudent(usn, windowId, subjectCodes) {
        const existing = this.registrations.find((r) => r.windowId === windowId && r.usn === usn);
        if (existing) {
            existing.subjectCodes = subjectCodes;
            existing.registeredAt = new Date().toISOString();
            return existing;
        }
        const reg = {
            windowId,
            usn,
            subjectCodes,
            registeredAt: new Date().toISOString(),
        };
        this.registrations.push(reg);
        return reg;
    }
    getPendingStudents(windowId) {
        const registered = new Set(this.registrations
            .filter((r) => r.windowId === windowId)
            .map((r) => r.usn));
        return this.eligibilities
            .filter((e) => e.windowId === windowId && e.isEligible && !registered.has(e.usn))
            .map((e) => ({ usn: e.usn, name: `Student ${e.usn}`, dept: 'CS' }));
    }
    getDeptOverview(windowId) {
        const depts = ['CS', 'EC', 'ME', 'CV'];
        return depts.map((dept) => ({
            dept,
            eligible: this.eligibilities.filter((e) => e.windowId === windowId).length,
            registered: this.registrations.filter((r) => r.windowId === windowId).length,
        }));
    }
    sendReminders(windowId, usnList) {
        return { reminded: usnList, windowId };
    }
    runEligibility(windowId) {
        return { processed: this.eligibilities.filter((e) => e.windowId === windowId).length, windowId };
    }
    getWindowById(id) {
        const win = this.windows.find((w) => w.id === id);
        if (!win)
            throw new common_1.NotFoundException('Window not found');
        return win;
    }
};
exports.VtuService = VtuService;
exports.VtuService = VtuService = __decorate([
    (0, common_1.Injectable)()
], VtuService);
//# sourceMappingURL=vtu.service.js.map