import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import axios from 'axios';
import {
  ChatSession,
  ChatMessage,
  TeacherEscalation,
  ChatUserRole,
} from '../entities/chatbot.entity';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL ?? 'http://localhost:8001';
const ESCALATION_THRESHOLD = 0.7;

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private sessions: ChatSession[] = [];
  private messages: Map<string, ChatMessage[]> = new Map();
  private escalations: TeacherEscalation[] = [];

  createSession(userId: string, userRole: ChatUserRole, studentId: string, institutionId: string): ChatSession {
    const session: ChatSession = {
      id: randomUUID(),
      userId,
      userRole,
      studentId,
      institutionId,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true,
    };
    this.sessions.push(session);
    this.messages.set(session.id, []);
    return session;
  }

  async sendMessage(
    sessionId: string,
    userMessage: string,
  ): Promise<{ message: ChatMessage; escalated: boolean; teacherName?: string }> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    session.lastActivityAt = new Date();
    const history = this.messages.get(sessionId) ?? [];

    const userMsg: ChatMessage = {
      id: randomUUID(),
      sessionId,
      role: 'USER',
      content: userMessage,
      escalatedToTeacher: false,
      createdAt: new Date(),
    };
    history.push(userMsg);

    // Build student context (production: query academics + attendance services)
    const studentContext = {
      name: `Student:${session.studentId}`,
      class_name: '10-A',
      recent_subjects: ['Mathematics', 'Physics', 'Chemistry'],
    };

    let aiResponse: { response: string; confidence_score: number };
    try {
      const resp = await axios.post(`${AI_ENGINE_URL}/llm/chat`, {
        user_role: session.userRole,
        student_context: studentContext,
        conversation_history: history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        message: userMessage,
        language: 'en',
      });
      aiResponse = resp.data as { response: string; confidence_score: number };
    } catch {
      this.logger.warn('AI engine unavailable, using stub response');
      aiResponse = { response: `[Stub AI response to: ${userMessage.slice(0, 60)}]`, confidence_score: 0.8 };
    }

    const needsEscalation = aiResponse.confidence_score < ESCALATION_THRESHOLD;
    const assistantMsg: ChatMessage = {
      id: randomUUID(),
      sessionId,
      role: 'ASSISTANT',
      content: needsEscalation
        ? "I've forwarded this to your teacher for a detailed answer. You'll hear back within 24 hours."
        : aiResponse.response,
      confidenceScore: aiResponse.confidence_score,
      escalatedToTeacher: needsEscalation,
      createdAt: new Date(),
    };
    history.push(assistantMsg);
    this.messages.set(sessionId, history);

    if (needsEscalation) {
      await this.createEscalation(session, userMessage, aiResponse.response, aiResponse.confidence_score);
    }

    return {
      message: assistantMsg,
      escalated: needsEscalation,
      teacherName: needsEscalation ? 'Class Teacher' : undefined,
    };
  }

  getHistory(sessionId: string): ChatMessage[] {
    return this.messages.get(sessionId) ?? [];
  }

  /**
   * Stateless ask — wraps the session-based flow into a single round-trip
   * for the Next.js chatbot widget. Conversation history is kept in memory
   * keyed by `conversationId` (a UUID returned to the client). If no
   * conversationId is passed in, a fresh one is minted.
   *
   * Falls back to a deterministic stub reply when the ai-engine is
   * unreachable so the UI never sees a 5xx.
   */
  async ask(input: {
    message: string;
    language: string;
    userRole: ChatUserRole;
    conversationId?: string;
  }): Promise<{ conversationId: string; message: string; timestamp: string }> {
    const conversationId = input.conversationId ?? randomUUID();
    const history = this.messages.get(conversationId) ?? [];

    history.push({
      id: randomUUID(),
      sessionId: conversationId,
      role: 'USER',
      content: input.message,
      escalatedToTeacher: false,
      createdAt: new Date(),
    });

    let reply: string;
    try {
      const resp = await axios.post(
        `${AI_ENGINE_URL}/llm/chat`,
        {
          user_role: input.userRole,
          student_context: { name: 'Guest', class_name: '-', recent_subjects: [] },
          conversation_history: history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          message: input.message,
          language: input.language,
        },
        { timeout: 15_000 },
      );
      reply = (resp.data as { response: string }).response;
    } catch (err) {
      this.logger.warn(`ai-engine unreachable for ask(): ${(err as Error).message}`);
      reply = `I'm temporarily offline. Please try again in a moment. (You asked: "${input.message.slice(0, 80)}")`;
    }

    const createdAt = new Date();
    history.push({
      id: randomUUID(),
      sessionId: conversationId,
      role: 'ASSISTANT',
      content: reply,
      escalatedToTeacher: false,
      createdAt,
    });
    this.messages.set(conversationId, history);

    return { conversationId, message: reply, timestamp: createdAt.toISOString() };
  }

  getTeacherEscalations(teacherId: string): TeacherEscalation[] {
    return this.escalations.filter(
      (e) => e.teacherId === teacherId && e.status === 'PENDING',
    );
  }

  respondToEscalation(escalationId: string, teacherId: string, response: string): TeacherEscalation | null {
    const esc = this.escalations.find((e) => e.id === escalationId && e.teacherId === teacherId);
    if (!esc) return null;
    esc.teacherResponse = response;
    esc.status = 'RESPONDED';
    // Production: push notification to student with teacher's response
    return esc;
  }

  private async createEscalation(
    session: ChatSession,
    question: string,
    aiAnswer: string,
    confidence: number,
  ): Promise<void> {
    const escalation: TeacherEscalation = {
      id: randomUUID(),
      sessionId: session.id,
      studentId: session.studentId,
      teacherId: `teacher:${session.institutionId}`,
      question,
      aiAttemptedAnswer: aiAnswer,
      aiConfidenceScore: confidence,
      studentProfileSummary: `Student ${session.studentId} — ${session.userRole}`,
      suggestedApproach: 'Provide step-by-step explanation with examples',
      relatedClassQueries: [],
      status: 'PENDING',
      createdAt: new Date(),
    };
    this.escalations.push(escalation);
    // Production: push notification to teacher
    this.logger.log('Escalated to teacher: sessionId=%s confidence=%.2f', session.id, confidence);
  }
}
