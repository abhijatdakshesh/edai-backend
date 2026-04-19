import { Module } from '@nestjs/common';
import { VtuController } from './vtu.controller';
import { VtuService } from './vtu.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [VtuController],
  providers: [VtuService],
  exports: [VtuService],
})
export class VtuModule {}
