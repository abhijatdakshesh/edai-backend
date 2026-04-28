import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FeeMessagingService {
  private readonly logger = new Logger(FeeMessagingService.name);

  private twilioAuth(): string {
    const sid = process.env['TWILIO_ACCOUNT_SID'] ?? '';
    const token = process.env['TWILIO_AUTH_TOKEN'] ?? '';
    return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
  }

  async sendWhatsApp(to: string, message: string): Promise<string> {
    const sid = process.env['TWILIO_ACCOUNT_SID'];
    if (!sid) {
      this.logger.warn('[FeeMessaging] Twilio not configured — WhatsApp skipped');
      return 'mock-sid';
    }
    const from = `whatsapp:${process.env['TWILIO_WHATSAPP_NUMBER'] ?? process.env['TWILIO_FROM_NUMBER'] ?? ''}`;
    const body = new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: message });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      { method: 'POST', headers: { Authorization: this.twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() },
    );
    if (!res.ok) throw new Error(`Twilio WhatsApp error ${res.status}`);
    const data = (await res.json()) as { sid: string };
    this.logger.log(`[FeeMessaging] WhatsApp sent to ${to}: ${data.sid}`);
    return data.sid;
  }

  async sendSms(to: string, message: string): Promise<string> {
    const sid = process.env['TWILIO_ACCOUNT_SID'];
    if (!sid) {
      this.logger.warn('[FeeMessaging] Twilio not configured — SMS skipped');
      return 'mock-sid';
    }
    const from = process.env['TWILIO_FROM_NUMBER'] ?? '';
    const body = new URLSearchParams({ From: from, To: to, Body: message });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      { method: 'POST', headers: { Authorization: this.twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() },
    );
    if (!res.ok) throw new Error(`Twilio SMS error ${res.status}`);
    const data = (await res.json()) as { sid: string };
    this.logger.log(`[FeeMessaging] SMS sent to ${to}: ${data.sid}`);
    return data.sid;
  }

  async triggerFeeCall(
    studentId: string,
    parentPhone: string,
    language: string,
    feeDetails: { feeType: string; balance: number; dueDate: string },
  ): Promise<string> {
    const voiceServiceUrl = process.env['VOICE_SERVICE_URL'] ?? 'http://localhost:8080';
    const res = await fetch(`${voiceServiceUrl}/voice/calls/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        callType: 'FEE_REMINDER',
        language,
        studentContext: { parentPhone, feeType: feeDetails.feeType, balance: feeDetails.balance, dueDate: feeDetails.dueDate },
      }),
    });
    if (!res.ok) throw new Error(`Voice service responded ${res.status}`);
    const data = (await res.json()) as { callId: string };
    this.logger.log(`[FeeMessaging] Voice call triggered for ${studentId}: ${data.callId}`);
    return data.callId;
  }
}
