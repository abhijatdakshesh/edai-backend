import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TimelineEvent } from '../entities/notification.entity';

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);
  private readonly events: TimelineEvent[] = [];

  create(
    userId: string,
    kind: string,
    title: string,
    body?: string,
    metadata?: Record<string, unknown>,
  ): TimelineEvent {
    const event: TimelineEvent = {
      id: randomUUID(),
      userId,
      kind,
      title,
      body,
      metadata,
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    this.logger.log(`TimelineEvent created: userId=${userId} kind=${kind}`);
    // Production: emit TimelineEventCreated Kafka event here
    return event;
  }

  byUser(userId: string, limit = 50): TimelineEvent[] {
    return this.events
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, limit);
  }
}
