import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import type { TimelineEvent } from '../entities/notification.entity';

@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Post()
  create(
    @Body()
    body: {
      userId: string;
      kind: string;
      title: string;
      body?: string;
      metadata?: Record<string, unknown>;
    },
  ): TimelineEvent {
    return this.timelineService.create(body.userId, body.kind, body.title, body.body, body.metadata);
  }

  @Get('user/:userId')
  byUser(
    @Param('userId') userId: string,
    @Query('limit') limit = '50',
  ): TimelineEvent[] {
    return this.timelineService.byUser(userId, parseInt(limit, 10));
  }
}
