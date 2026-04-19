import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatUserRole } from '../entities/chatbot.entity';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly svc: ChatbotService) {}

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
