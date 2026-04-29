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
      secret: process.env['JWT_SECRET'] ?? 'edai-dev-secret-change-in-production',
      signOptions: { expiresIn: '15m', issuer: 'edai-identity', audience: 'edai-services' },
    }),
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotGateway, KnowledgeGraphService, TwilioWebhookGuard],
  exports: [ChatbotService],
})
export class ChatbotModule {}
