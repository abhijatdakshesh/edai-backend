import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NotificationsService, SendNotificationDto } from './notifications.service';
import { NotificationTemplate } from '../entities/notification.entity';

@Controller('comms')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Post('send')
  send(@Body() dto: SendNotificationDto) {
    return this.svc.send(dto);
  }

  @Get('logs/:recipientId')
  getLogs(@Param('recipientId') id: string) {
    return this.svc.getLogs(id);
  }

  @Post('templates')
  createTemplate(@Body() dto: Omit<NotificationTemplate, 'id' | 'createdAt'>) {
    return this.svc.createTemplate(dto);
  }

  @Get('templates')
  listTemplates() {
    return this.svc.listTemplates();
  }
}
