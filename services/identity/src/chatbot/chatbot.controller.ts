import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class ChatbotController {
  constructor(private readonly svc: ChatbotService) {}

  @Get('chatbot/dashboard')
  getDashboard() {
    return this.svc.getDashboard();
  }

  @Post('chatbot/query')
  query(
    @Body() body: { sessionId?: string; message: string },
    @Request() req: any,
  ) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.query(body.sessionId, body.message, usn);
  }

  @Post('chatbot/sessions/resolve')
  resolve(@Body() body: { sessionId: string }) {
    return this.svc.resolve(body.sessionId);
  }
}
