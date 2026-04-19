import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications/notifications.module';
import { TimelineModule } from './timeline/timeline.module';
import { HealthModule } from './health/health.module';
import { ParentCommsModule } from './parent-comms/parent-comms.module';

@Module({ imports: [NotificationsModule, TimelineModule, HealthModule, ParentCommsModule] })
export class AppModule {}
