import { Module } from '@nestjs/common';
import { AttendanceApiController } from './attendance-api.controller';
import { AttendanceApiService } from './attendance-api.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [AttendanceApiController],
  providers: [AttendanceApiService],
  exports: [AttendanceApiService],
})
export class AttendanceApiModule {}
