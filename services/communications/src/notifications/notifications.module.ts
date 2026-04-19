import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { SmsService } from '../sms/sms.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, WhatsAppService, SmsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
