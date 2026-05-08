import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { VtuService } from './vtu.service';
import { VtuNotificationsService } from './vtu-notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsGateway } from '../events/events.gateway';

@UseGuards(JwtAuthGuard)
@Controller()
export class VtuController {
  constructor(
    private readonly svc: VtuService,
    private readonly notifications: VtuNotificationsService,
    private readonly events: EventsGateway,
  ) {}

  // Live VTU notifications/circulars — surfaced on every portal dashboard
  // (admin/principal/hod/teacher/student/parent). 30-min in-process cache.
  @Get('vtu/notifications')
  getVtuNotifications() {
    return this.notifications.getNotifications();
  }

  @Get('vtu/windows')
  getAllWindows() {
    return this.svc.getAllWindows();
  }

  @Get('vtu/windows/active')
  getActiveWindow() {
    return this.svc.getActiveWindow();
  }

  @Post('vtu/windows')
  createWindow(
    @Body()
    body: {
      title: string;
      openDate: string;
      closeDate: string;
      semester: number;
    },
  ) {
    const win = this.svc.createWindow(body);
    this.events.emitVtuWindowOpened({ windowId: win.id, title: win.title });
    return win;
  }

  @Get('vtu/student/status')
  getStudentStatus(
    @Query('windowId') windowId: string,
    @Request() req: any,
  ) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getStudentStatus(usn, windowId);
  }

  @Post('vtu/student/register')
  registerStudent(
    @Body() body: { windowId: string; subjectCodes: string[] },
    @Request() req: any,
  ) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.registerStudent(usn, body.windowId, body.subjectCodes);
  }

  @Get('vtu/admin/pending')
  getPendingStudents(@Query('windowId') windowId: string) {
    return this.svc.getPendingStudents(windowId);
  }

  @Get('vtu/admin/dept-overview')
  getDeptOverview(@Query('windowId') windowId: string) {
    return this.svc.getDeptOverview(windowId);
  }

  @Post('vtu/admin/remind')
  sendReminders(
    @Body() body: { windowId: string; usnList: string[] },
  ) {
    return this.svc.sendReminders(body.windowId, body.usnList);
  }

  @Post('vtu/admin/run-eligibility')
  runEligibility(@Body() body: { windowId: string }) {
    return this.svc.runEligibility(body.windowId);
  }

  @Get('parent/children/:usn/vtu-status')
  getChildVtuStatus(
    @Param('usn') usn: string,
    @Query('windowId') windowId: string,
  ) {
    return this.svc.getStudentStatus(usn, windowId);
  }

  @Get('vtu/windows/:id')
  getWindow(@Param('id') id: string) {
    return this.svc.getWindowById(id);
  }

  @Get('vtu/windows/:windowId/dept-overview')
  getDeptOverviewByWindow(@Param('windowId') wId: string) {
    return this.svc.getDeptOverview(wId);
  }

  @Get('vtu/windows/:windowId/pending')
  getPendingByWindow(@Param('windowId') wId: string) {
    return this.svc.getPendingStudents(wId);
  }

  @Post('vtu/windows/:windowId/remind')
  remindByWindow(
    @Param('windowId') wId: string,
    @Body() body: { usnList: string[] },
  ) {
    return this.svc.sendReminders(wId, body.usnList);
  }

  @Post('vtu/windows/:windowId/eligibility-check')
  eligibilityCheck(@Param('windowId') wId: string) {
    return this.svc.runEligibility(wId);
  }
}
