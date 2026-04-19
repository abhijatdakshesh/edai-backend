import { Module } from '@nestjs/common';
import { ChatbotModule } from './chatbot/chatbot.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [ChatbotModule, HealthModule] })
export class AppModule {}
