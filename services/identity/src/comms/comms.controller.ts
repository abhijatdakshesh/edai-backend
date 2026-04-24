import { BadRequestException, Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Get('comms/announcements')
  getAnnouncements(@Request() req: any) {
    const institutionId: string = req.user?.institutionId ?? process.env.INSTITUTION_ID;
    if (!institutionId) throw new BadRequestException('institutionId not resolvable from token');
    return this.svc.getAnnouncements(institutionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('comms/calls')
  getCallsByClass(@Query('classId') classId: string, @Request() req: any) {
    if (!classId) throw new BadRequestException('classId is required');
    const institutionId: string = req.user?.institutionId ?? process.env.INSTITUTION_ID;
    if (!institutionId) throw new BadRequestException('institutionId not resolvable from token');
    return this.svc.getCallsByClass(classId, institutionId);
  }

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

  @Post('comms/calls/trigger')
  triggerCall(@Body() body: { studentUsn: string; type: string }) {
    return this.svc.triggerCall(body.studentUsn, body.type);
  }

  @Post('comms/sms/send')
  sendSms(@Body() body: { phone: string; message: string }) {
    return this.svc.sendSms(body.phone, body.message);
  }

  @UseGuards(JwtAuthGuard)
  @Post('comms/announcements')
  createAnnouncement(
    @Body() body: { title: string; content: string; audience: string },
    @Request() req: any,
  ) {
    const institutionId: string = req.user?.institutionId ?? process.env.INSTITUTION_ID ?? 'default';
    return this.svc.createAnnouncement(body.title, body.content, body.audience, institutionId);
  }

  @Post('parent-comms/calls/trigger')
  triggerParentCall(@Body() body: { parentId: string; studentUsn: string }) {
    return this.svc.triggerParentCall(body.parentId, body.studentUsn);
  }

  @Get('parent-comms/notifications')
  getNotifications(@Request() req: any) {
    const parentId = req.user?.sub ?? 'unknown';
    return this.svc.getNotifications(parentId);
  }

  // IMPORTANT: read-all MUST be before :id/read to avoid routing conflict
  @Patch('parent-comms/notifications/read-all')
  markAllRead(@Request() req: any) {
    const parentId = req.user?.sub ?? 'unknown';
    return this.svc.markAllRead(parentId);
  }

  @Patch('parent-comms/notifications/:id/read')
  markRead(@Param('id') id: string) {
    return this.svc.markNotificationRead(id);
  }
}
