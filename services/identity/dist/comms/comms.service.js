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
    constructor(events) {
        this.events = events;
        this.callLogs = [];
        this.messages = [];
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
};
exports.CommsService = CommsService;
exports.CommsService = CommsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [events_gateway_1.EventsGateway])
], CommsService);
//# sourceMappingURL=comms.service.js.map