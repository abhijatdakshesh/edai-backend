import { Injectable } from '@nestjs/common';
import { EventsGateway } from '../events/events.gateway';

export interface AICallLog {
  id: string;
  calledAt: string;
  studentName: string;
  studentUsn: string;
  parentId: string;
  outcome: 'ANSWERED' | 'VOICEMAIL' | 'NO_ANSWER' | 'BUSY';
  duration: number;
  transcript?: string;
  summary?: string;
}

export interface Message {
  id: string;
  parentId: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  sentAt: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
}

@Injectable()
export class CommsService {
  callLogs: AICallLog[] = [];
  messages: Message[] = [];

  constructor(private readonly events: EventsGateway) {}

  getRecentCalls(limit = 20): AICallLog[] {
    return this.callLogs.slice(-limit).reverse();
  }

  getParentCalls(parentId: string): AICallLog[] {
    return this.callLogs.filter((c) => c.parentId === parentId);
  }

  getParentMessages(parentId: string): Message[] {
    return this.messages.filter((m) => m.parentId === parentId);
  }

  getAdminCallLogs(): AICallLog[] {
    return this.callLogs;
  }

  completeCall(callId: string, studentUsn: string): void {
    const log = this.callLogs.find((c) => c.id === callId);
    if (log) {
      this.events.emitAiCallCompleted({ callId, studentUsn });
    }
  }

  triggerCall(usn: string, type: string): { callId: string; status: 'QUEUED'; scheduledAt: string } {
    return {
      callId: `call-${Date.now()}`,
      status: 'QUEUED',
      scheduledAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }

  sendSms(phone: string, message: string): { messageId: string; status: 'SENT' } {
    return { messageId: `sms-${Date.now()}`, status: 'SENT' };
  }

  createAnnouncement(
    title: string,
    content: string,
    audience: string,
  ): { id: string; title: string; content: string; audience: string; createdAt: string } {
    return { id: `ann-${Date.now()}`, title, content, audience, createdAt: new Date().toISOString() };
  }

  triggerParentCall(parentId: string, usn: string): { callId: string; status: 'QUEUED' } {
    return { callId: `pcall-${Date.now()}`, status: 'QUEUED' };
  }

  notifications: Array<{ id: string; parentId: string; type: string; title: string; message: string; read: boolean; createdAt: string }> = [];

  getNotifications(parentId: string): Array<{ id: string; type: string; title: string; message: string; read: boolean; createdAt: string }> {
    const stored = this.notifications.filter((n) => n.parentId === parentId);
    if (stored.length > 0) return stored;
    return [
      { id: 'notif-1', type: 'ATTENDANCE', title: 'Attendance Alert', message: 'Your child was absent on 17-Apr', read: false, createdAt: new Date().toISOString() },
      { id: 'notif-2', type: 'FEES', title: 'Fee Reminder', message: 'Semester fee is due in 7 days', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
    ];
  }

  markNotificationRead(id: string): { ok: true } {
    const n = this.notifications.find((n) => n.id === id);
    if (n) n.read = true;
    return { ok: true };
  }

  markAllRead(parentId: string): { ok: true; count: number } {
    const unread = this.notifications.filter((n) => n.parentId === parentId && !n.read);
    unread.forEach((n) => (n.read = true));
    return { ok: true, count: unread.length };
  }
}
