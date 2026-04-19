import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications/notifications.module';
import { TimelineModule } from './timeline/timeline.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [NotificationsModule, TimelineModule, HealthModule] })
export class AppModule {}
