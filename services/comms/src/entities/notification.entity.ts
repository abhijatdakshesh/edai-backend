export type NotificationChannel = 'WHATSAPP' | 'SMS' | 'PUSH' | 'EMAIL';
export type NotificationStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRYING';

export interface NotificationRecord {
  id: string;
  userId: string;
  channel: NotificationChannel;
  templateId: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  attemptCount: number;
  sentAt?: string;
  failureReason?: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}
