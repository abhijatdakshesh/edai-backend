import { Controller, Post, Get, Body, Headers, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { ChatbotService } from './chatbot.service';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { TwilioWebhookGuard } from './twilio-webhook.guard';

@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly kgService: KnowledgeGraphService,
  ) {}

  // PUBLIC — guarded by Twilio signature validation only
  @Post('webhook/whatsapp')
  @UseGuards(TwilioWebhookGuard)
  async handleWhatsAppMessage(
    @Body() body: Record<string, string>,
    @Headers() _headers: Record<string, string>,
  ): Promise<{ status: string }> {
    const rawPhone = (body['From'] ?? '').replace('whatsapp:', '').replace(/\D/g, '');
    const message = (body['Body'] ?? '').trim();
    if (!rawPhone || !message) return { status: 'ignored' };

    try {
      let graph;
      let role: string;
      let identifier: string;

      try {
        graph = await this.kgService.buildParentGraph(rawPhone);
        role = 'PARENT';
        identifier = rawPhone;
      } catch {
        // Try as student phone
        graph = await this.kgService.buildStudentGraph(rawPhone);
        role = 'STUDENT';
        identifier = rawPhone;
      }

      const conversationId = await this.chatbotService.getOrCreateConversation(
        identifier, role, 'WHATSAPP', graph.preferredLanguage,
      );

      let fullResponse = '';
      await this.chatbotService.chatStream(conversationId, message, graph, (chunk) => {
        fullResponse += chunk;
      });

      // Send via Twilio
      const accountSid = process.env['TWILIO_ACCOUNT_SID'];
      const authToken = process.env['TWILIO_AUTH_TOKEN'];
      const from = process.env['TWILIO_WHATSAPP_FROM'];
      if (accountSid && authToken && from) {
        const twilio = (await import('twilio')).default;
        const client = twilio(accountSid, authToken);
        await client.messages.create({
          from: `whatsapp:${from}`,
          to: `whatsapp:+91${rawPhone}`,
          body: fullResponse,
        });
      }

      return { status: 'ok' };
    } catch (err) {
      return { status: 'error' };
    }
  }

  // REST fallback for web chat (WebSocket unavailable)
  @UseGuards(JwtAuthGuard)
  @Post('message')
  async restChat(
    @Req() req: { user: { sub: string; role?: string; sapId?: string; phone?: string; email?: string; empCode?: string; name?: string } },
    @Body() body: { message: string; conversationId?: string },
  ): Promise<{ conversationId: string; message: string; timestamp: string }> {
    const { sub, role = 'STUDENT', sapId, phone, email, empCode, name } = req.user;
    // Resolve the right identifier per role — student/teacher graphs key on
    // domain identifiers (USN/empCode/phone), NOT the auth UUID `sub`.
    let identifier = sub;
    let graph;
    try {
      if (role === 'STUDENT') {
        identifier = sapId || sub;
        graph = await this.kgService.buildStudentGraph(identifier);
      } else if (role === 'TEACHER' || role === 'FACULTY' || role === 'HOD') {
        identifier = empCode || email || sub;
        graph = await this.kgService.buildTeacherGraph(identifier);
      } else if (role === 'PARENT') {
        // Prefer phone (matches WhatsApp/SMS path), but the demo seed parent
        // has no phone in the JWT — fall back to the user UUID `sub` so the
        // graph builder can resolve it via parent_student_links / demo map.
        identifier = (phone || '').replace(/\D/g, '') || sub;
        graph = await this.kgService.buildParentGraph(identifier);
      } else if (role === 'ADMIN' || role === 'PRINCIPAL' || role === 'DEAN' || role === 'TRUSTEE' || role === 'COUNSELLOR') {
        graph = await this.kgService.buildAdminGraph(sub);
      } else if (role === 'RECRUITER') {
        // Recruiter chatbot — keyed on the auth UUID `sub` since recruiters
        // don't have a USN/empCode. Falls back to a realistic demo graph
        // when the recruiter has no jobs yet (KAN-28).
        graph = await this.kgService.buildRecruiterGraph(sub, name);
      } else {
        throw new Error('Unsupported role for chatbot');
      }
    } catch (err) {
      // Graph build failed (e.g. demo user missing in students table) — fall
      // back to a minimal graph so the user still gets a personalised reply
      // rather than a public-mode answer.
      graph = role === 'STUDENT'
        ? await this.kgService.buildStudentGraph(sapId || sub).catch(() => null)
        : null;
      if (!graph) {
        const reply = await this.chatbotService.askPublic(body.message);
        return { conversationId: 'public-' + Date.now(), message: reply, timestamp: new Date().toISOString() };
      }
    }

    const conversationId = body.conversationId
      ?? await this.chatbotService.getOrCreateConversation(identifier, role, 'WEB', graph.preferredLanguage);

    let fullResponse = '';
    await this.chatbotService.chatStream(conversationId, body.message, graph, (chunk) => {
      fullResponse += chunk;
    });

    return { conversationId, message: fullResponse, timestamp: new Date().toISOString() };
  }

  // PUBLIC — anonymous chatbot for pre-login visitors. Returns college-info-only
  // answers (no student PII, no DB lookups). Rate-limit at gateway / WAF.
  @Post('public/ask')
  async publicAsk(
    @Body() body: { message: string },
  ): Promise<{ message: string; timestamp: string }> {
    const message = (body?.message ?? '').toString().trim();
    if (!message) return { message: 'Please ask a question.', timestamp: new Date().toISOString() };
    const reply = await this.chatbotService.askPublic(message);
    return { message: reply, timestamp: new Date().toISOString() };
  }

  // Admin: list chat sessions
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL')
  @Get('sessions')
  getSessions(): Promise<unknown[]> {
    return this.chatbotService.getSessions();
  }

  // Legacy: keep old dashboard endpoint working
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL')
  @Get('dashboard')
  getDashboard(): object {
    return {
      totalSessions: 0,
      openSessions: 0,
      avgResponseTime: 0,
      topTopics: ['Attendance', 'Fees', 'Schedule', 'Marks', 'Detention risk'],
      note: 'Live data — query chat_conversations table for real counts',
    };
  }
}
