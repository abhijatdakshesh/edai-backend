import { EventsGateway } from '../events/events.gateway';
export interface AICallLog {
    id: string;
    calledAt: string;
    studentName: string;
    studentUsn: string;
    parentId: string;
    parentPhone?: string;
    triggeredBy?: string;
    language?: string;
    classId?: string;
    institutionId?: string;
    outcome: 'ANSWERED' | 'VOICEMAIL' | 'NO_ANSWER' | 'BUSY' | 'FAILED';
    duration: number;
    transcript?: string;
    summary?: string;
}
export interface Announcement {
    id: string;
    institutionId: string;
    title: string;
    content: string;
    audience: string;
    createdAt: string;
}
export interface MessageReply {
    id: string;
    fromId: string;
    fromName: string;
    body: string;
    createdAt: string;
}
export interface Message {
    id: string;
    parentId: string;
    parentName: string;
    studentUsn: string;
    recipientId: string;
    recipientName: string;
    subject: string;
    body: string;
    status: 'SENT' | 'READ' | 'REPLIED';
    replies: MessageReply[];
    createdAt: string;
    content?: string;
    direction?: 'INBOUND' | 'OUTBOUND';
    sentAt?: string;
    channel?: 'WHATSAPP' | 'SMS' | 'EMAIL';
}
export declare class CommsService {
    private readonly events;
    callLogs: AICallLog[];
    messages: Message[];
    announcements: Announcement[];
    getAnnouncements(institutionId: string): Announcement[];
    getCallsByClass(classId: string, institutionId?: string): AICallLog[];
    constructor(events: EventsGateway);
    getRecentCalls(limit?: number): AICallLog[];
    getParentCalls(parentId: string): AICallLog[];
    getParentMessages(parentId: string): Message[];
    getAdminCallLogs(): AICallLog[];
    completeCall(callId: string, studentUsn: string): void;
    triggerCall(usn: string, type: string): {
        callId: string;
        status: 'QUEUED';
        scheduledAt: string;
    };
    sendSms(phone: string, message: string): {
        messageId: string;
        status: 'SENT';
    };
    createAnnouncement(title: string, content: string, audience: string, institutionId?: string): Announcement;
    triggerParentCall(parentId: string, usn: string): {
        callId: string;
        status: 'QUEUED';
    };
    notifications: Array<{
        id: string;
        parentId: string;
        type: string;
        title: string;
        message: string;
        read: boolean;
        createdAt: string;
    }>;
    getNotifications(parentId: string): Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        read: boolean;
        createdAt: string;
    }>;
    markNotificationRead(id: string): {
        ok: true;
    };
    markAllRead(parentId: string): {
        ok: true;
        count: number;
    };
}
