export type NotificationChannel = 'WHATSAPP' | 'SMS' | 'PUSH' | 'EMAIL';
export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';

export type TimelineEventKind =
  | 'ABSENT_MARKED'
  | 'CALL_PLACED'
  | 'CALL_COMPLETED'
  | 'CALL_MISSED'
  | 'ASSIGNMENT_DUE'
  | 'ASSIGNMENT_SUBMITTED'
  | 'ASSIGNMENT_MISSED'
  | 'MARKS_PUBLISHED'
  | 'PERFORMANCE_DROP'
  | 'PERFORMANCE_IMPROVED'
  | 'FEE_DUE'
  | 'FEE_PAID'
  | 'FEE_OVERDUE'
  | 'BEHAVIORAL_INCIDENT'
  | 'PTM_SCHEDULED'
  | 'WEEKLY_REPORT'
  | 'ESCALATION_TRIGGERED';

export type TimelineVisibility = 'STUDENT' | 'PARENT' | 'TEACHER' | 'ALL';

export interface NotificationTemplate {
  id: string;
  institutionId?: string;
  code: string;
  channel: NotificationChannel;
  language: string;
  subject?: string;
  bodyTemplate: string;
  createdAt: Date;
}

export interface NotificationLog {
  id: string;
  recipientId: string;
  studentId: string;
  channel: NotificationChannel;
  templateCode: string;
  payloadJson: Record<string, unknown>;
  status: NotificationStatus;
  externalId?: string;
  sentAt?: Date;
  failedReason?: string;
  createdAt: Date;
}

export interface TimelineEvent {
  id: string;
  studentId: string;
  institutionId: string;
  ts: Date;
  kind: TimelineEventKind;
  actorId?: string;
  visibility: TimelineVisibility;
  payloadJson: Record<string, unknown>;
  createdAt: Date;
}
