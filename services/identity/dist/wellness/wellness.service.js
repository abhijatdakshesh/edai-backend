"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WellnessService = void 0;
const common_1 = require("@nestjs/common");
let WellnessService = class WellnessService {
    constructor() {
        this.slots = [];
        this.sessions = [];
        this.studyTasks = [];
        this.riskScores = new Map();
        this.resources = [
            { title: 'Stress Management 101', type: 'article', url: 'https://edai.in/resources/stress-101' },
            { title: 'Mindfulness for Students', type: 'video', url: 'https://edai.in/resources/mindfulness' },
            { title: 'Time Management Tips', type: 'guide', url: 'https://edai.in/resources/time-mgmt' },
            { title: 'Study Techniques', type: 'article', url: 'https://edai.in/resources/study-tech' },
        ];
    }
    getSlots() {
        return this.slots.filter((s) => !s.isBooked);
    }
    getMySessions(usn) {
        return this.sessions.filter((s) => s.studentUsn === usn);
    }
    bookSession(usn, slotId, reason) {
        const slot = this.slots.find((s) => s.id === slotId);
        if (!slot)
            throw new common_1.NotFoundException('Slot not found');
        slot.isBooked = true;
        const session = {
            id: `sess-${Date.now()}`,
            slotId,
            studentUsn: usn,
            reason,
            status: 'BOOKED',
        };
        this.sessions.push(session);
        return session;
    }
    getRiskScore(usn) {
        return (this.riskScores.get(usn) ?? {
            score: 30,
            level: 'LOW',
            factors: ['Attendance above 80%', 'Assignments on track'],
        });
    }
    getStudyPlan(usn) {
        return { tasks: this.studyTasks.filter((t) => t.usn === usn) };
    }
    updateTask(taskId, done) {
        const task = this.studyTasks.find((t) => t.id === taskId);
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        task.done = done;
        return task;
    }
    getResources() {
        return this.resources;
    }
};
exports.WellnessService = WellnessService;
exports.WellnessService = WellnessService = __decorate([
    (0, common_1.Injectable)()
], WellnessService);
//# sourceMappingURL=wellness.service.js.map