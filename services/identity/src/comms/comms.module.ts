import { Module } from '@nestjs/common';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';
import { EventsModule } from '../events/events.module';
import { StudentPortalModule } from '../student-portal/student-portal.module';

@Module({
  imports: [EventsModule, StudentPortalModule],
  controllers: [CommsController],
  providers: [CommsService],
  exports: [CommsService],
})
export class CommsModule {}
