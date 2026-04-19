import { Module } from '@nestjs/common';
import { MentorshipModule } from './mentorship/mentorship.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [MentorshipModule, HealthModule] })
export class AppModule {}
