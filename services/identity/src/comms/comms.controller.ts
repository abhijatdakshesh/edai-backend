import { BadRequestException, ForbiddenException, Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CommsService } from './comms.service';
import { ConsentService, ConsentChannel } from './consent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StudentPortalService } from '../student-portal/student-portal.service';

@Controller()
class PublicCommsController {
  constructor(private readonly svc: CommsService) {}

  /** TwiML webhook — Twilio fetches this when call connects */
  @ Get('comms/twiml/:callId')
  serveTwiml(@Param('callId') callId: string, @Res() res: Response) {
    const baseUrl = process.env['TWILIO_WEBHOOK_BASE_URL'] ?? process.env['APP_URL'] ?? 'http://localhost:3001';
    const audioUrl = `${baseUrl}/api/comms/audio/${callId}`;
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Play>${audioUrl}</Play><Pause length="2"/><Hangup/></Response>`);
  }

  /** Audio file endpoint — serves Sarvam AI generated WAV */
  @ Get('comms/audio/:callId')
  serveAudio(@Param('callId') callId: string, @Res() res: Response) {
    const buf = this.svc.getAudio(callId);
    if (!buf) { res.status(404).send('Audio not found'); return; }
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', buf.length);
    res.send(buf);
  }
}

export { PublicCommsController };

@UseGuards(JwtAuthGuard)
@Controller()
export class CommsController {
  constructor(
    private readonly svc: CommsService,
    private readonly consentSvc: ConsentService,
    private readonly studentPortalSvc: StudentPortalService,
  ) {}

  @ Get('comms/announcements')
  getAnnouncements(@Request() req: any) {
    const institutionId: string = req.user?.institutionId ?? process.env.INSTITUTION_ID;
    if (!institutionId) throw new BadRequestException('institutionId not resolvable from token');
    return this.svc.getAnnouncements(institutionId);
  }

  @ Get('comms/calls')
  getCallsByClass(@Query('classId') classId: string, @Request() req: any) {
    if (!classId) throw new BadRequestException('classId is required');
    const institutionId: string = req.user?.institutionId ?? process.env.INSTITUTION_ID;
    if (!institutionId) throw new BadRequestException('institutionId not resolvable from token');
    return this.svc.getCallsByClass(classId, institutionId);
  }

  @ Get('comms/calls/recent')
  getRecentCalls() {
    return this.svc.getRecentCalls();
  }

  @ Get('parent-comms/calls')
  getParentCalls(@Request() req: any) {
    // Use token sub — parentId from query string is an IDOR vector
    const parentId: string = req.user?.sub ?? 'unknown';
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'];
    return this.svc.getParentCalls(parentId, institutionId);
  }

  @ Get('parent-comms/messages')
  getParentMessages(@Request() req: any) {
    const parentId: string = req.user?.sub ?? 'unknown';
    return this.svc.getParentMessages(parentId);
  }

  @ Get('admin/calls/logs')
  getAdminCallLogs(@Request() req: any) {
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'];
    return this.svc.getAdminCallLogs(institutionId);
  }

  @ Post('comms/calls/trigger')
  async triggerCall(@Body() body: { studentUsn: string; type: string; language?: string }) {
    return this.svc.triggerCall(body.studentUsn, body.type, 'rvce', body.language ?? 'en');
  }

  @ Post('comms/sms/send')
  sendSms(@Body() body: { phone: string; message: string }) {
    return this.svc.sendSms(body.phone, body.message);
  }

  @ Post('comms/announcements')
  createAnnouncement(
    @Body() body: { title: string; content: string; audience: string },
    @Request() req: any,
  ) {
    const institutionId: string = req.user?.institutionId ?? process.env.INSTITUTION_ID ?? 'default';
    return this.svc.createAnnouncement(body.title, body.content, body.audience, institutionId);
  }

  @ Post('parent-comms/calls/trigger')
  triggerParentCall(@Body() body: { parentId: string; studentUsn: string; type: string }, @Request() req: any) {
    // Admins/principals/etc may trigger calls on behalf of any parent. Parents themselves
    // can only trigger their own calls (sub must match parentId).
    const role = req.user?.role;
    const authenticatedUserId = req.user?.sub;
    const isStaff = role === 'ADMIN' || role === 'PRINCIPAL' || role === 'DEAN' || role === 'COUNSELLOR';
    if (!isStaff && authenticatedUserId && authenticatedUserId !== body.parentId) {
      throw new ForbiddenException('Cannot trigger calls for another parent');
    }
    return this.svc.triggerParentCall(body.parentId, body.studentUsn, body.type);
  }

  @ Get('parent-comms/notifications')
  getNotifications(@Request() req: any) {
    const parentId = req.user?.sub ?? 'unknown';
    return this.svc.getNotifications(parentId);
  }

  // IMPORTANT: read-all MUST be before :id/read to avoid routing conflict
  @ Patch('parent-comms/notifications/read-all')
  markAllRead(@Request() req: any) {
    const parentId = req.user?.sub ?? 'unknown';
    return this.svc.markAllRead(parentId);
  }

  @ Patch('parent-comms/notifications/:id/read')
  markRead(@Param('id') id: string) {
    return this.svc.markNotificationRead(id);
  }

  // ─── DPDP Consent endpoints ────────────────────────────────────────────────

  /** Grant consent for one or more channels. Called during parent/student onboarding. */
  @ Post('consent/grant')
  grantConsent(
    @Body() body: { channels: ConsentChannel[] },
    @Request() req: any,
  ) {
    const principalId: string = req.user?.sub ?? 'unknown';
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'] ?? 'default';
    return this.consentSvc.grant(principalId, body.channels, institutionId);
  }

  /** Revoke specific channels. DPDP requires revocation to be honoured immediately. */
  @ Post('consent/revoke')
  revokeConsent(
    @Body() body: { channels: ConsentChannel[] },
    @Request() req: any,
  ) {
    const principalId: string = req.user?.sub ?? 'unknown';
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'] ?? 'default';
    this.consentSvc.revoke(principalId, body.channels, institutionId);
    return { ok: true };
  }

  /** Revoke all consent — data principal right under DPDP Act 2023. */
  @ Delete('consent')
  revokeAllConsent(@Request() req: any) {
    const principalId: string = req.user?.sub ?? 'unknown';
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'] ?? 'default';
    this.consentSvc.revokeAll(principalId, institutionId);
    return { ok: true };
  }

  /** Get current consent status for the authenticated principal. */
  @ Get('consent')
  getConsent(@Request() req: any) {
    const principalId: string = req.user?.sub ?? 'unknown';
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'] ?? 'default';
    return this.consentSvc.getConsent(principalId, institutionId) ?? { active: false, channels: [] };
  }
}
