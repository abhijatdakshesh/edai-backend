import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotGateway } from './chatbot.gateway';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { TwilioWebhookGuard } from './twilio-webhook.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: (() => {
        const s = process.env['JWT_SECRET'];
        if (!s) throw new Error('JWT_SECRET environment variable is required');
        return s;
      })(),
      signOptions: { expiresIn: '15m', issuer: 'edai-identity', audience: 'edai-services' },
    }),
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotGateway, KnowledgeGraphService, TwilioWebhookGuard],
  exports: [ChatbotService],
})
export class ChatbotModule {}
