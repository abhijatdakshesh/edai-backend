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
exports.CommsService = void 0;
const common_1 = require("@nestjs/common");
const events_gateway_1 = require("../events/events.gateway");
let CommsService = class CommsService {
    getAnnouncements(institutionId) {
        return this.announcements.filter((a) => a.institutionId === institutionId);
    }
    getCallsByClass(classId, institutionId) {
        return this.callLogs.filter((c) => c.classId === classId && (!institutionId || c.institutionId === institutionId));
    }
    constructor(events) {
        this.events = events;
        this.callLogs = [];
        this.messages = [];
        this.announcements = [];
        this.notifications = [];
    }
    getRecentCalls(limit = 20) {
        return this.callLogs.slice(-limit).reverse();
    }
    getParentCalls(parentId) {
        return this.callLogs.filter((c) => c.parentId === parentId);
    }
    getParentMessages(parentId) {
        return this.messages.filter((m) => m.parentId === parentId);
    }
    getAdminCallLogs() {
        return this.callLogs;
    }
    completeCall(callId, studentUsn) {
        const log = this.callLogs.find((c) => c.id === callId);
        if (log) {
            this.events.emitAiCallCompleted({ callId, studentUsn });
        }
    }
    triggerCall(usn, type) {
        return {
            callId: `call-${Date.now()}`,
            status: 'QUEUED',
            scheduledAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        };
    }
    sendSms(phone, message) {
        return { messageId: `sms-${Date.now()}`, status: 'SENT' };
    }
    createAnnouncement(title, content, audience, institutionId = 'default') {
        const ann = { id: `ann-${Date.now()}`, institutionId, title, content, audience, createdAt: new Date().toISOString() };
        this.announcements.push(ann);
        return ann;
    }
    triggerParentCall(parentId, usn) {
        return { callId: `pcall-${Date.now()}`, status: 'QUEUED' };
    }
    getNotifications(parentId) {
        const stored = this.notifications.filter((n) => n.parentId === parentId);
        if (stored.length > 0)
            return stored;
        return [
            { id: 'notif-1', type: 'ATTENDANCE', title: 'Attendance Alert', message: 'Your child was absent on 17-Apr', read: false, createdAt: new Date().toISOString() },
            { id: 'notif-2', type: 'FEES', title: 'Fee Reminder', message: 'Semester fee is due in 7 days', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
        ];
    }
    markNotificationRead(id) {
        const n = this.notifications.find((n) => n.id === id);
        if (n)
            n.read = true;
        return { ok: true };
    }
    markAllRead(parentId) {
        const unread = this.notifications.filter((n) => n.parentId === parentId && !n.read);
        unread.forEach((n) => (n.read = true));
        return { ok: true, count: unread.length };
    }
};
exports.CommsService = CommsService;
exports.CommsService = CommsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [events_gateway_1.EventsGateway])
], CommsService);
//# sourceMappingURL=comms.service.js.map