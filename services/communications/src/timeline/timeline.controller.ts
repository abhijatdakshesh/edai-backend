import { Controller, Get, Param, Query } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { TimelineEventKind } from '../entities/notification.entity';

@Controller('comms/timeline')
export class TimelineController {
  constructor(private readonly svc: TimelineService) {}

  @Get(':studentId')
  getTimeline(
    @Param('studentId') studentId: string,
    @Query('kinds') kinds?: string,
  ) {
    const kindList = kinds
      ? (kinds.split(',') as TimelineEventKind[])
      : undefined;
    return this.svc.list(studentId, kindList);
  }
}
