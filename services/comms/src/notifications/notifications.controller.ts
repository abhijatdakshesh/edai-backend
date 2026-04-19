import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import type { NotificationRecord } from '../entities/notification.entity';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  async send(
    @Body()
    body: {
      userId: string;
      channel: string;
      templateId: string;
      payload: Record<string, unknown>;
    },
  ): Promise<NotificationRecord> {
    return this.notificationsService.send({
      userId: body.userId,
      channel: body.channel as NotificationRecord['channel'],
      templateId: body.templateId,
      payload: body.payload,
    });
  }

  @Get('user/:userId')
  byUser(@Param('userId') userId: string): NotificationRecord[] {
    return this.notificationsService.byUser(userId);
  }

  @Post('retry-failed')
  retryFailed(): { queued: number } {
    return { queued: this.notificationsService.retryFailed() };
  }
}
