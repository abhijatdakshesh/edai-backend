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
}
