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
export declare class CommsService {
    private readonly events;
    callLogs: AICallLog[];
    messages: Message[];
    constructor(events: EventsGateway);
    getRecentCalls(limit?: number): AICallLog[];
    getParentCalls(parentId: string): AICallLog[];
    getParentMessages(parentId: string): Message[];
    getAdminCallLogs(): AICallLog[];
    completeCall(callId: string, studentUsn: string): void;
}
