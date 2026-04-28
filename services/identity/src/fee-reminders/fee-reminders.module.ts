import { Module } from '@nestjs/common';
import { FeeRemindersController } from './fee-reminders.controller';
import { FeeRemindersService } from './fee-reminders.service';
import { FeeMessagingService } from './fee-messaging.service';

@Module({
  controllers: [FeeRemindersController],
  providers: [FeeRemindersService, FeeMessagingService],
  exports: [FeeRemindersService],
})
export class FeeRemindersModule {}
