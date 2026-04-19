import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NotificationRecord, NotificationChannel } from '../entities/notification.entity';

interface SendNotificationInput {
  userId: string;
  channel: NotificationChannel;
  templateId: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly records: NotificationRecord[] = [];

  async send(input: SendNotificationInput): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: randomUUID(),
      ...input,
      status: 'QUEUED',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.records.push(record);

    // Simulate dispatch
    await this.dispatch(record);
    return record;
  }

  private async dispatch(record: NotificationRecord): Promise<void> {
    record.attemptCount += 1;
    this.logger.log(
      `Dispatching ${record.channel} notification to user=${record.userId} template=${record.templateId}`,
    );

    // Production: route to Meta WhatsApp / Karix SMS / FCM / SendGrid based on channel
    record.status = 'SENT';
    record.sentAt = new Date().toISOString();
  }

  byUser(userId: string): NotificationRecord[] {
    return this.records.filter((n) => n.userId === userId);
  }

  retryFailed(): number {
    const failed = this.records.filter((n) => n.status === 'FAILED');
    for (const record of failed) {
      record.status = 'RETRYING';
      void this.dispatch(record);
    }
    return failed.length;
  }
}
