import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GrievanceService, type GrievancePriority, type GrievanceStatus } from './grievance.service';

@Controller('grievances')
export class GrievanceController {
  constructor(private readonly grievanceService: GrievanceService) {}

  @Post()
  file(
    @Body()
    body: { filedBy: string; category: string; description: string; priority: GrievancePriority },
  ): unknown {
    return this.grievanceService.file(body.filedBy, body.category, body.description, body.priority);
  }

  @Post(':id/transition')
  transition(
    @Param('id') id: string,
    @Body() body: { status: GrievanceStatus; by: string; resolution?: string },
  ): unknown {
    return this.grievanceService.transition(id, body.status, body.by, body.resolution);
  }

  @Get()
  list(@Query('status') status?: GrievanceStatus): unknown {
    return this.grievanceService.list(status);
  }

  @Get(':id')
  byId(@Param('id') id: string): unknown {
    return this.grievanceService.byId(id);
  }
}
