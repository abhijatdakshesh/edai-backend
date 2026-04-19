/**
 * ParentCommsService
 *
 * Solves the principal's #1 pain point: Parent-Student interaction.
 *
 * Features:
 * 1. Parent Notification Feed — parent sees all alerts for their child
 *    (low attendance, exam dates, fees due, placement drives, etc.)
 * 2. Parent-Teacher Messaging — parent sends a message to teacher/admin;
 *    teacher can reply in the teacher portal
 * 3. AI Voice Call trigger — when student is absent 3+ consecutive days,
 *    auto-trigger a voice call to parent in their preferred language
 * 4. SMS Alerts — critical one-way alerts (exam results, fee due, etc.)
 * 5. Call Log — full history of AI calls made to parent
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type NotificationType =
  | 'ATTENDANCE_LOW'
  | 'ABSENT_CONSECUTIVE'
  | 'FEE_DUE'
  | 'EXAM_RESULT'
  | 'IA_MARKS'
  | 'PLACEMENT_DRIVE'
  | 'ANNOUNCEMENT'
  | 'CALL_SUMMARY';

export interface ParentNotification {
  id: string;
  parentId: string;
  studentUsn: string;
  studentName: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'REPLIED';

export interface ParentMessage {
  id: string;
  parentId: string;
  parentName: string;
  studentUsn: string;
  recipientId: string; // teacher/admin user ID
  recipientName: string;
  subject: string;
  body: string;
  status: MessageStatus;
  replies: {
    id: string;
    fromId: string;
    fromName: string;
    body: string;
    createdAt: string;
  }[];
  createdAt: string;
}

export type CallOutcome = 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'FAILED';

export interface AiCallRecord {
  id: string;
  studentUsn: string;
  studentName: string;
  parentPhone: string;
  parentId: string;
  triggeredBy: string; // 'AUTO_ABSENCE' | 'MANUAL_TEACHER' | 'FEE_DUE'
  language: string;
  calledAt: string;
  duration: number; // seconds
  outcome: CallOutcome;
  transcript?: string;
  summary?: string; // AI-generated call summary
}

// ─── In-memory stores ─────────────────────────────────────────────────────────
const NOTIFICATIONS: ParentNotification[] = [
  {
    id: randomUUID(), parentId: 'u-parent-01', studentUsn: '1RV21CS001',
    studentName: 'Priya Sharma', type: 'ATTENDANCE_LOW', severity: 'WARNING',
    title: 'Attendance Warning — Priya Sharma',
    body: 'Priya\'s attendance in Machine Learning has dropped to 68%. Minimum required: 75%. Please ensure regular attendance.',
    read: false, createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: randomUUID(), parentId: 'u-parent-01', studentUsn: '1RV21CS001',
    studentName: 'Priya Sharma', type: 'EXAM_RESULT', severity: 'INFO',
    title: 'IA-1 Results Published',
    body: 'IA-1 results for Machine Learning: 18/20 (90%). Excellent performance!',
    read: true, createdAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
  },
  {
    id: randomUUID(), parentId: 'u-parent-01', studentUsn: '1RV21CS001',
    studentName: 'Priya Sharma', type: 'FEE_DUE', severity: 'CRITICAL',
    title: 'Fee Payment Reminder',
    body: 'Semester 6 examination fee of ₹2,400 is due by January 15, 2025. Please pay to avoid late fees.',
    read: false, createdAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
  },
  {
    id: randomUUID(), parentId: 'u-parent-01', studentUsn: '1RV21CS001',
    studentName: 'Priya Sharma', type: 'ABSENT_CONSECUTIVE', severity: 'CRITICAL',
    title: 'Consecutive Absences — Action Required',
    body: 'Priya was absent for 3 consecutive classes (Jan 10, 11, 12). An AI call has been scheduled to your registered mobile number.',
    read: false, createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const MESSAGES: ParentMessage[] = [
  {
    id: randomUUID(), parentId: 'u-parent-01', parentName: 'Ramesh Sharma',
    studentUsn: '1RV21CS001', recipientId: 'u-faculty-01', recipientName: 'Rajesh Kumar',
    subject: 'Query about ML attendance', status: 'REPLIED',
    body: 'Sir, I wanted to discuss Priya\'s attendance in Machine Learning. She was unwell last week.',
    replies: [
      {
        id: randomUUID(), fromId: 'u-faculty-01', fromName: 'Rajesh Kumar',
        body: 'Thank you for reaching out. Please submit a medical certificate to the office. I will update the attendance records accordingly.',
        createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
];

const CALL_RECORDS: AiCallRecord[] = [
  {
    id: randomUUID(), studentUsn: '1RV21CS001', studentName: 'Priya Sharma',
    parentPhone: '+91-9876543210', parentId: 'u-parent-01',
    triggeredBy: 'AUTO_ABSENCE', language: 'en',
    calledAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    duration: 42, outcome: 'ANSWERED',
    summary: 'Parent was informed about 3 consecutive absences. Parent confirmed child was ill and will submit medical certificate. Will resume attendance from tomorrow.',
  },
  {
    id: randomUUID(), studentUsn: '1RV21CS002', studentName: 'Arjun Reddy',
    parentPhone: '+91-9876543211', parentId: 'u-parent-02',
    triggeredBy: 'MANUAL_TEACHER', language: 'kn',
    calledAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    duration: 0, outcome: 'NO_ANSWER',
    summary: 'Call not answered. SMS fallback sent.',
  },
];

@Injectable()
export class ParentCommsService {

  // ─── Notifications ────────────────────────────────────────────────────────

  getNotifications(parentId: string): ParentNotification[] {
    return NOTIFICATIONS
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  markNotificationRead(notificationId: string): void {
    const n = NOTIFICATIONS.find((n) => n.id === notificationId);
    if (n) n.read = true;
  }

  markAllRead(parentId: string): void {
    NOTIFICATIONS.filter((n) => n.parentId === parentId).forEach((n) => (n.read = true));
  }

  pushNotification(data: Omit<ParentNotification, 'id' | 'read' | 'createdAt'>): ParentNotification {
    const notif: ParentNotification = {
      ...data,
      id: randomUUID(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    NOTIFICATIONS.push(notif);
    return notif;
  }

  // ─── Messaging ────────────────────────────────────────────────────────────

  getMessages(parentId: string): ParentMessage[] {
    return MESSAGES
      .filter((m) => m.parentId === parentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  sendMessage(data: {
    parentId: string;
    parentName: string;
    studentUsn: string;
    recipientId: string;
    recipientName: string;
    subject: string;
    body: string;
  }): ParentMessage {
    const msg: ParentMessage = {
      id: randomUUID(),
      ...data,
      status: 'SENT',
      replies: [],
      createdAt: new Date().toISOString(),
    };
    MESSAGES.push(msg);
    return msg;
  }

  replyToMessage(messageId: string, fromId: string, fromName: string, body: string): ParentMessage {
    const msg = MESSAGES.find((m) => m.id === messageId);
    if (!msg) throw new Error(`Message ${messageId} not found`);
    msg.replies.push({ id: randomUUID(), fromId, fromName, body, createdAt: new Date().toISOString() });
    msg.status = 'REPLIED';
    return msg;
  }

  // ─── AI Calls ─────────────────────────────────────────────────────────────

  getCallHistory(parentId?: string, studentUsn?: string): AiCallRecord[] {
    return CALL_RECORDS.filter(
      (c) =>
        (!parentId || c.parentId === parentId) &&
        (!studentUsn || c.studentUsn === studentUsn),
    ).sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime());
  }

  triggerCall(data: {
    studentUsn: string;
    studentName: string;
    parentPhone: string;
    parentId: string;
    triggeredBy: string;
    language?: string;
  }): AiCallRecord {
    // In production: call voice service API → Exotel/Plivo/Twilio
    const record: AiCallRecord = {
      id: randomUUID(),
      ...data,
      language: data.language ?? 'en',
      calledAt: new Date().toISOString(),
      duration: 0,
      outcome: 'NO_ANSWER', // updated via webhook after call completes
    };
    CALL_RECORDS.push(record);

    // Also push a notification to parent
    this.pushNotification({
      parentId: data.parentId,
      studentUsn: data.studentUsn,
      studentName: data.studentName,
      type: 'ABSENT_CONSECUTIVE',
      severity: 'CRITICAL',
      title: `AI Call Initiated — ${data.studentName}`,
      body: `An automated call has been placed to ${data.parentPhone}. Reason: ${data.triggeredBy}`,
    });

    return record;
  }

  updateCallOutcome(callId: string, outcome: CallOutcome, transcript?: string, summary?: string): AiCallRecord {
    const call = CALL_RECORDS.find((c) => c.id === callId);
    if (!call) throw new Error(`Call record ${callId} not found`);
    call.outcome = outcome;
    if (transcript) call.transcript = transcript;
    if (summary) call.summary = summary;
    return call;
  }
}
