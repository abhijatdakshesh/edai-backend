import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotificationLog, NotificationTemplate } from '../entities/notification.entity';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { SmsService } from '../sms/sms.service';

export interface SendNotificationDto {
  recipientId: string;
  studentId: string;
  channel: 'WHATSAPP' | 'SMS' | 'PUSH' | 'EMAIL';
  templateCode: string;
  payload: Record<string, unknown>;
  language?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private logs: NotificationLog[] = [];
  private templates: NotificationTemplate[] = [];

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly sms: SmsService,
  ) {}

  async send(dto: SendNotificationDto): Promise<NotificationLog> {
    const log: NotificationLog = {
      id: randomUUID(),
      recipientId: dto.recipientId,
      studentId: dto.studentId,
      channel: dto.channel,
      templateCode: dto.templateCode,
      payloadJson: dto.payload,
      status: 'PENDING',
      createdAt: new Date(),
    };
    this.logs.push(log);

    try {
      if (dto.channel === 'WHATSAPP') {
        await this.whatsapp.sendTemplate(
          dto.recipientId,
          dto.templateCode,
          dto.language ?? 'en',
          [],
        );
      } else if (dto.channel === 'SMS') {
        await this.sms.sendSms(dto.recipientId, JSON.stringify(dto.payload));
      } else if (dto.channel === 'PUSH') {
        // Production: Firebase Admin SDK sendToDevice
        this.logger.log('PUSH notification stub to %s', dto.recipientId);
      } else if (dto.channel === 'EMAIL') {
        // Production: SendGrid API
        this.logger.log('EMAIL stub to %s', dto.recipientId);
      }
      log.status = 'SENT';
      log.sentAt = new Date();
    } catch (err: unknown) {
      log.status = 'FAILED';
      log.failedReason = (err as Error).message;
    }

    return log;
  }

  getLogs(recipientId: string): NotificationLog[] {
    return this.logs.filter((l) => l.recipientId === recipientId);
  }

  createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt'>): NotificationTemplate {
    const t: NotificationTemplate = { id: randomUUID(), ...template, createdAt: new Date() };
    this.templates.push(t);
    return t;
  }

  listTemplates(): NotificationTemplate[] {
    return this.templates;
  }
}
