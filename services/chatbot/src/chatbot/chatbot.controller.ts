import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatUserRole } from '../entities/chatbot.entity';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly svc: ChatbotService) {}

  // ── Frontend-facing simple ask endpoints ──
  // The Next.js chatbot widget calls these directly (via the apps/web
  // /api/chatbot/{public/ask,message} proxy routes). They wrap the
  // session-based flow into a single round-trip so the widget doesn't
  // have to create + remember a session id.

  @Post('public/ask')
  async publicAsk(@Body() dto: { message: string; language?: string }) {
    const reply = await this.svc.ask({
      message: dto.message,
      language: dto.language ?? 'en',
      userRole: 'STUDENT',
    });
    return { message: reply.message, timestamp: reply.timestamp };
  }

  @Post('message')
  async authedAsk(
    @Body()
    dto: {
      message: string;
      conversationId?: string;
      userRole?: ChatUserRole;
      language?: string;
    },
  ) {
    const reply = await this.svc.ask({
      message: dto.message,
      language: dto.language ?? 'en',
      userRole: dto.userRole ?? 'STUDENT',
      conversationId: dto.conversationId,
    });
    return {
      conversationId: reply.conversationId,
      message: reply.message,
      timestamp: reply.timestamp,
    };
  }

  @Post('sessions')
  createSession(
    @Body()
    dto: {
      userId: string;
      userRole: ChatUserRole;
      studentId: string;
      institutionId: string;
    },
  ) {
    return this.svc.createSession(dto.userId, dto.userRole, dto.studentId, dto.institutionId);
  }

  @Post('sessions/:id/messages')
  sendMessage(
    @Param('id') sessionId: string,
    @Body() dto: { message: string },
  ) {
    return this.svc.sendMessage(sessionId, dto.message);
  }

  @Get('sessions/:id/history')
  getHistory(@Param('id') sessionId: string) {
    return this.svc.getHistory(sessionId);
  }

  @Get('escalations/teacher/:id')
  getEscalations(@Param('id') teacherId: string) {
    return this.svc.getTeacherEscalations(teacherId);
  }

  @Post('escalations/:id/respond')
  respond(
    @Param('id') escalationId: string,
    @Body() dto: { teacherId: string; response: string },
  ) {
    return this.svc.respondToEscalation(escalationId, dto.teacherId, dto.response);
  }
}
