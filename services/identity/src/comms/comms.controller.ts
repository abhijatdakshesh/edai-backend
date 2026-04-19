import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CommsService } from './comms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StudentPortalService } from '../student-portal/student-portal.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class CommsController {
  constructor(
    private readonly svc: CommsService,
    private readonly studentPortalSvc: StudentPortalService,
  ) {}

  @Get('comms/calls/recent')
  getRecentCalls() {
    return this.svc.getRecentCalls();
  }

  @Get('parent-comms/calls')
  getParentCalls(@Query('parentId') parentId: string) {
    return this.svc.getParentCalls(parentId);
  }

  @Get('parent-comms/messages')
  getParentMessages(@Query('parentId') parentId: string) {
    return this.svc.getParentMessages(parentId);
  }

  @Get('admin/calls/logs')
  getAdminCallLogs() {
    return this.svc.getAdminCallLogs();
  }
}
