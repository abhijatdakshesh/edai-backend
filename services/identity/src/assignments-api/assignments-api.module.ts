import { Module } from '@nestjs/common';
import { AssignmentsApiController } from './assignments-api.controller';
import { AssignmentsApiService } from './assignments-api.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [AssignmentsApiController],
  providers: [AssignmentsApiService],
  exports: [AssignmentsApiService],
})
export class AssignmentsApiModule {}
