import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatbotService } from './chatbot.service';
import { KnowledgeGraphService } from './knowledge-graph.service';

const CORS_ORIGINS = process.env['CORS_ORIGINS']
  ? process.env['CORS_ORIGINS'].split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: CORS_ORIGINS, credentials: true },
  transports: ['websocket', 'polling'],
})
export class ChatbotGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatbotGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatbotService: ChatbotService,
    private readonly knowledgeGraphService: KnowledgeGraphService,
  ) {}

  handleConnection(client: Socket): void {
    const token = (client.handshake.auth as Record<string, unknown>)?.token as string | undefined
      ?? (client.handshake.headers?.authorization as string | undefined)?.replace('Bearer ', '');

    if (!token) {
      this.logger.warn(`Chat WS rejected — no token: ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; role?: string }>(token, {
        issuer: 'edai-identity',
        audience: 'edai-services',
      });
      client.data.user = payload;
      this.logger.log(`Chat WS connected: ${client.id} role=${payload.role}`);
    } catch {
      this.logger.warn(`Chat WS rejected — invalid token: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Chat WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @MessageBody() data: { message: string; conversationId?: string; language?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = client.data?.user as { sub: string; role?: string } | undefined;
    if (!user) {
      client.emit('chat:error', { message: 'Not authenticated' });
      return;
    }

    const { sub: identifier, role = 'STUDENT' } = user;

    try {
      let graph;
      if (role === 'STUDENT') {
        graph = await this.knowledgeGraphService.buildStudentGraph(identifier);
      } else if (role === 'TEACHER' || role === 'FACULTY' || role === 'HOD') {
        graph = await this.knowledgeGraphService.buildTeacherGraph(identifier);
      } else if (role === 'PARENT') {
        graph = await this.knowledgeGraphService.buildParentGraph(identifier);
      } else if (role === 'ADMIN' || role === 'PRINCIPAL' || role === 'DEAN' || role === 'TRUSTEE' || role === 'COUNSELLOR') {
        graph = await this.knowledgeGraphService.buildAdminGraph(identifier);
      } else {
        client.emit('chat:error', { message: 'Chatbot not available for your role.' });
        return;
      }

      // Allow client to override language; default to English
      if (data.language) graph = { ...graph, preferredLanguage: data.language };
      else graph = { ...graph, preferredLanguage: graph.preferredLanguage ?? 'en' };

      const conversationId = data.conversationId
        ?? await this.chatbotService.getOrCreateConversation(identifier, role, 'WEB', graph.preferredLanguage);

      client.emit('chat:typing', { conversationId });

      await this.chatbotService.chatStream(
        conversationId,
        data.message,
        graph,
        (chunk: string) => client.emit('chat:chunk', { conversationId, text: chunk }),
      );

      client.emit('chat:done', { conversationId, timestamp: new Date().toISOString() });
    } catch (err) {
      this.logger.error('Chat message error', err);
      client.emit('chat:error', { message: 'Something went wrong. Please try again.' });
    }
  }

  @SubscribeMessage('chat:history')
  async handleHistory(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = client.data?.user as { sub: string; role?: string } | undefined;
    if (!user) {
      client.emit('chat:error', { message: 'Not authenticated' });
      return;
    }
    try {
      const history = await this.chatbotService.getHistory(data.conversationId, user.sub);
      client.emit('chat:history', history);
    } catch {
      client.emit('chat:error', { message: 'Could not load history.' });
    }
  }

  @SubscribeMessage('chat:consent')
  async handleConsent(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await this.chatbotService.recordConsent(data.conversationId);
    client.emit('chat:consent:ack', { ok: true });
  }
}
