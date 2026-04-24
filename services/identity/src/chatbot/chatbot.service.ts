import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatbotService {
  sessions: Map<string, { usn: string; messages: Array<{ role: string; content: string }> }> = new Map();

  getDashboard(): {
    totalSessions: number;
    openSessions: number;
    avgResponseTime: number;
    topTopics: string[];
  } {
    return {
      totalSessions: 142,
      openSessions: 8,
      avgResponseTime: 1.4,
      topTopics: ['Attendance queries', 'Fee payment', 'Exam schedule', 'Assignment deadlines', 'Counseling slots'],
    };
  }

  query(
    sessionId: string | undefined,
    message: string,
    usn: string,
  ): { reply: string; sessionId: string; intent: string } {
    const sid = sessionId ?? `session-${Date.now()}`;
    const intents: Record<string, string> = {
      attendance: 'ATTENDANCE_QUERY',
      fee: 'FEE_QUERY',
      exam: 'EXAM_SCHEDULE',
      assignment: 'ASSIGNMENT_QUERY',
      default: 'GENERAL_QUERY',
    };
    const lMsg = message.toLowerCase();
    const intent =
      lMsg.includes('attend') ? intents.attendance :
      lMsg.includes('fee') || lMsg.includes('pay') ? intents.fee :
      lMsg.includes('exam') ? intents.exam :
      lMsg.includes('assign') ? intents.assignment :
      intents.default;

    const replies: Record<string, string> = {
      ATTENDANCE_QUERY: 'Your current attendance is 82%. You need to attend at least 75% of classes to be eligible for exams.',
      FEE_QUERY: 'Your next fee payment of ₹45,000 is due on 30 April 2026. You can pay via the Fees section.',
      EXAM_SCHEDULE: 'Your end semester exams are scheduled from 15 May 2026. Check the academic calendar for the full schedule.',
      ASSIGNMENT_QUERY: 'You have 2 pending assignments due this week. Check the Assignments section for details.',
      GENERAL_QUERY: 'I\'m here to help! You can ask me about attendance, fees, exams, assignments, or counseling.',
    };

    return {
      reply: replies[intent] ?? replies.GENERAL_QUERY,
      sessionId: sid,
      intent,
    };
  }

  resolve(sessionId: string): { ok: true; resolvedAt: string } {
    this.sessions.delete(sessionId);
    return { ok: true, resolvedAt: new Date().toISOString() };
  }
}
