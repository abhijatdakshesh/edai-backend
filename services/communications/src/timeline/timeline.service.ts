import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  TimelineEvent,
  TimelineEventKind,
  TimelineVisibility,
} from '../entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';

interface CreateTimelineEventDto {
  studentId: string;
  institutionId: string;
  kind: TimelineEventKind;
  actorId?: string;
  visibility: TimelineVisibility;
  payload: Record<string, unknown>;
}

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);
  private events: TimelineEvent[] = [];

  constructor(private readonly notifications: NotificationsService) {}

  create(dto: CreateTimelineEventDto): TimelineEvent {
    const event: TimelineEvent = {
      id: randomUUID(),
      studentId: dto.studentId,
      institutionId: dto.institutionId,
      ts: new Date(),
      kind: dto.kind,
      actorId: dto.actorId,
      visibility: dto.visibility,
      payloadJson: dto.payload,
      createdAt: new Date(),
    };
    this.events.push(event);
    // KAFKA: emit 'comms.timeline.event.created'
    this.logger.debug('Timeline event: %s student=%s', event.kind, event.studentId);
    return event;
  }

  list(studentId: string, kinds?: TimelineEventKind[]): TimelineEvent[] {
    return this.events
      .filter((e) => {
        if (e.studentId !== studentId) return false;
        if (kinds && kinds.length > 0 && !kinds.includes(e.kind)) return false;
        return true;
      })
      .sort((a, b) => b.ts.getTime() - a.ts.getTime());
  }

  /** Kafka consumer handler for attendance.absent.marked */
  async handleAbsentMarked(event: Record<string, unknown>): Promise<void> {
    this.create({
      studentId: event['studentId'] as string,
      institutionId: event['institutionId'] as string,
      kind: 'ABSENT_MARKED',
      actorId: event['teacherId'] as string,
      visibility: 'ALL',
      payload: event,
    });
  }

  /** Kafka consumer handler for voice.call.completed */
  async handleCallCompleted(event: Record<string, unknown>): Promise<void> {
    this.create({
      studentId: event['studentId'] as string,
      institutionId: 'default',
      kind: 'CALL_COMPLETED',
      visibility: 'PARENT',
      payload: event,
    });
    // Send WhatsApp summary to parent
    await this.notifications.send({
      recipientId: event['parentId'] as string,
      studentId: event['studentId'] as string,
      channel: 'WHATSAPP',
      templateCode: 'ABSENT_CALL_SUMMARY',
      payload: event,
    });
  }

  /** Kafka consumer handler for assignments.missed */
  async handleAssignmentMissed(event: Record<string, unknown>): Promise<void> {
    this.create({
      studentId: event['studentId'] as string,
      institutionId: 'default',
      kind: 'ASSIGNMENT_MISSED',
      visibility: 'PARENT',
      payload: event,
    });
    await this.notifications.send({
      recipientId: event['parentId'] as string ?? event['studentId'] as string,
      studentId: event['studentId'] as string,
      channel: 'WHATSAPP',
      templateCode: 'ASSIGNMENT_MISSED_REMINDER',
      payload: event,
    });
  }

  /** Kafka consumer handler for academics.performance.drop */
  async handlePerformanceDrop(event: Record<string, unknown>): Promise<void> {
    this.create({
      studentId: event['studentId'] as string,
      institutionId: 'default',
      kind: 'PERFORMANCE_DROP',
      visibility: 'PARENT',
      payload: event,
    });
  }

  /** Kafka consumer handler for finance.fee.overdue */
  async handleFeeOverdue(event: Record<string, unknown>): Promise<void> {
    this.create({
      studentId: event['studentId'] as string,
      institutionId: 'default',
      kind: 'FEE_OVERDUE',
      visibility: 'PARENT',
      payload: event,
    });
    await this.notifications.send({
      recipientId: event['parentId'] as string,
      studentId: event['studentId'] as string,
      channel: 'WHATSAPP',
      templateCode: 'FEE_REMINDER',
      payload: event,
    });
  }

  /** Kafka consumer handler for behavior.incident.logged */
  async handleBehavioralIncident(event: Record<string, unknown>): Promise<void> {
    const severity = event['severity'] as string;
    this.create({
      studentId: event['studentId'] as string,
      institutionId: event['institutionId'] as string,
      kind: 'BEHAVIORAL_INCIDENT',
      visibility: 'PARENT',
      payload: event,
    });
    if (severity === 'MEDIUM' || severity === 'HIGH') {
      await this.notifications.send({
        recipientId: event['parentId'] as string ?? '',
        studentId: event['studentId'] as string,
        channel: 'WHATSAPP',
        templateCode: 'BEHAVIORAL_ALERT',
        payload: event,
      });
    }
  }
}
