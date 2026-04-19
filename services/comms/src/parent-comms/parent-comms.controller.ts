import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ParentCommsService } from './parent-comms.service';

@Controller('parent-comms')
export class ParentCommsController {
  constructor(private readonly svc: ParentCommsService) {}

  // ─── Notifications ──────────────────────────────────────────────────────────

  /**
   * GET /api/parent-comms/notifications?parentId=
   * All notifications for a parent, newest first.
   */
  @Get('notifications')
  getNotifications(@Query('parentId') parentId: string) {
    return this.svc.getNotifications(parentId);
  }

  /**
   * PATCH /api/parent-comms/notifications/:id/read
   */
  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string) {
    this.svc.markNotificationRead(id);
    return { ok: true };
  }

  /**
   * PATCH /api/parent-comms/notifications/read-all?parentId=
   */
  @Patch('notifications/read-all')
  markAllRead(@Query('parentId') parentId: string) {
    this.svc.markAllRead(parentId);
    return { ok: true };
  }

  /**
   * POST /api/parent-comms/notifications
   * Push a notification to a parent (called internally by other services).
   */
  @Post('notifications')
  pushNotification(@Body() body: Parameters<ParentCommsService['pushNotification']>[0]) {
    return this.svc.pushNotification(body);
  }

  // ─── Messaging ──────────────────────────────────────────────────────────────

  /**
   * GET /api/parent-comms/messages?parentId=
   */
  @Get('messages')
  getMessages(@Query('parentId') parentId: string) {
    return this.svc.getMessages(parentId);
  }

  /**
   * POST /api/parent-comms/messages
   * Parent sends a message to a teacher/admin.
   */
  @Post('messages')
  sendMessage(@Body() body: Parameters<ParentCommsService['sendMessage']>[0]) {
    return this.svc.sendMessage(body);
  }

  /**
   * POST /api/parent-comms/messages/:id/reply
   * Teacher/admin replies to a parent message.
   * Body: { fromId, fromName, body }
   */
  @Post('messages/:id/reply')
  replyToMessage(
    @Param('id') messageId: string,
    @Body() body: { fromId: string; fromName: string; body: string },
  ) {
    return this.svc.replyToMessage(messageId, body.fromId, body.fromName, body.body);
  }

  // ─── AI Calls ───────────────────────────────────────────────────────────────

  /**
   * GET /api/parent-comms/calls?parentId=&studentUsn=
   */
  @Get('calls')
  getCallHistory(
    @Query('parentId') parentId?: string,
    @Query('studentUsn') studentUsn?: string,
  ) {
    return this.svc.getCallHistory(parentId, studentUsn);
  }

  /**
   * POST /api/parent-comms/calls/trigger
   * Trigger an AI voice call to a parent.
   * Body: { studentUsn, studentName, parentPhone, parentId, triggeredBy, language? }
   */
  @Post('calls/trigger')
  triggerCall(@Body() body: Parameters<ParentCommsService['triggerCall']>[0]) {
    return this.svc.triggerCall(body);
  }

  /**
   * PATCH /api/parent-comms/calls/:id/outcome
   * Webhook callback — update call outcome after it completes.
   * Body: { outcome, transcript?, summary? }
   */
  @Patch('calls/:id/outcome')
  updateCallOutcome(
    @Param('id') callId: string,
    @Body() body: { outcome: string; transcript?: string; summary?: string },
  ) {
    return this.svc.updateCallOutcome(
      callId,
      body.outcome as Parameters<ParentCommsService['updateCallOutcome']>[1],
      body.transcript,
      body.summary,
    );
  }
}
