import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { FeeMessagingService } from './fee-messaging.service';

const WA_TEMPLATES: Record<
  string,
  (name: string, bal: number, due: string, days: number) => string
> = {
  kn: (name, bal, due, days) =>
    `ನಮಸ್ಕಾರ ${name} ಅವರೇ,\n\nRVITM ಶುಲ್ಕ ನೆನಪಿನ ಸಂದೇಶ.\n\n📌 ಬಾಕಿ: ₹${bal.toLocaleString('en-IN')}\n📅 ಕೊನೆಯ ದಿನ: ${due}\n⏰ ${days} ದಿನ ಉಳಿದಿದೆ\n\nದಯವಿಟ್ಟು ಸಮಯಕ್ಕೆ ಪಾವತಿ ಮಾಡಿ.\naccounts@rvitm.edu.in`,
  hi: (name, bal, due, days) =>
    `नमस्ते ${name} जी,\n\nRVITM फीस अनुस्मारक।\n\n📌 बकाया: ₹${bal.toLocaleString('en-IN')}\n📅 अंतिम तिथि: ${due}\n⏰ ${days} दिन शेष\n\nकृपया समय पर फीस जमा करें।\naccounts@rvitm.edu.in`,
  ta: (name, bal, due, days) =>
    `வணக்கம் ${name},\n\nRVITM கட்டண நினைவூட்டல்.\n\n📌 நிலுவை: ₹${bal.toLocaleString('en-IN')}\n📅 கடைசி தேதி: ${due}\n⏰ ${days} நாட்கள்\n\nதயவுசெய்து கட்டணம் செலுத்துங்கள்.\naccounts@rvitm.edu.in`,
  te: (name, bal, due, days) =>
    `నమస్కారం ${name},\n\nRVITM రుసుము రిమైండర్.\n\n📌 బాకీ: ₹${bal.toLocaleString('en-IN')}\n📅 చివరి తేదీ: ${due}\n⏰ ${days} రోజులు\n\nసమయానికి చెల్లించండి.\naccounts@rvitm.edu.in`,
  en: (name, bal, due, days) =>
    `Dear ${name},\n\nFee reminder from RVITM.\n\n📌 Balance: ₹${bal.toLocaleString('en-IN')}\n📅 Due Date: ${due}\n⏰ ${days} day(s) remaining\n\nPlease pay before the due date.\naccounts@rvitm.edu.in`,
};

const SMS_TEMPLATES: Record<
  string,
  (name: string, bal: number, due: string) => string
> = {
  kn: (name, bal, due) =>
    `RVITM: ${name} ಅವರಿಗೆ ₹${bal.toLocaleString('en-IN')} ಶುಲ್ಕ ${due} ರಂದು ಕೊನೆ. ದಯವಿಟ್ಟು ಪಾವತಿ ಮಾಡಿ.`,
  hi: (name, bal, due) =>
    `RVITM: ${name} की ₹${bal.toLocaleString('en-IN')} फीस ${due} तक जमा करें।`,
  en: (name, bal, due) =>
    `RVITM: Dear ${name}, fee of Rs.${bal.toLocaleString('en-IN')} due on ${due}. Please pay on time.`,
};

export interface FeeRiskRow {
  fee_payment_id: string;
  student_usn: string;
  student_name: string;
  parent_phone: string;
  language: string;
  fee_type: string;
  balance: number;
  due_date: Date;
  days_to_due: number;
  risk_score: number;
  risk_level: string;
  fee_status: string;
  department: string;
  attendance_pct: number;
}

// Validates that VOICE_SERVICE_URL is http/https and not a private/link-local address.
// Exported for unit testing.
export function validateVoiceServiceUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`VOICE_SERVICE_URL is not a valid URL: ${url}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`VOICE_SERVICE_URL must be http or https, got: ${parsed.protocol}`);
  }
  // Block link-local and cloud metadata endpoints (SSRF prevention)
  const host = parsed.hostname;
  if (host === '169.254.169.254' || host.startsWith('169.254.') || host === 'metadata.google.internal') {
    throw new Error('VOICE_SERVICE_URL resolves to a restricted address');
  }
}

@Injectable()
export class FeeRemindersService {
  private readonly logger = new Logger(FeeRemindersService.name);
  private readonly voiceServiceUrl: string;

  constructor(
    @Optional() @InjectDataSource() private readonly db: DataSource | null,
    private readonly messaging: FeeMessagingService,
  ) {
    this.voiceServiceUrl = process.env['VOICE_SERVICE_URL'] ?? 'http://localhost:8080';
    validateVoiceServiceUrl(this.voiceServiceUrl);
  }

  // Nightly at 9:00 AM IST = 03:30 UTC
  @Cron('30 3 * * *')
  async runNightlyReminderChain(): Promise<void> {
    this.logger.log('[FeeReminder] Starting nightly reminder chain...');
    if (!this.db) {
      this.logger.warn('[FeeReminder] No DB — reminder chain skipped.');
      return;
    }

    // LIMIT prevents unbounded batch at large colleges; process highest-risk first
    const fees = await this.db.query<FeeRiskRow[]>(`
      SELECT * FROM fee_risk_scores
      WHERE parent_phone IS NOT NULL
        AND parent_phone != ''
        AND days_to_due BETWEEN -1 AND 10
      ORDER BY risk_score DESC
      LIMIT 500
    `);

    this.logger.log(`[FeeReminder] ${fees.length} fees in reminder window`);
    let sent = 0;
    for (const fee of fees) {
      try {
        await this.processReminder(fee);
        sent++;
      } catch (err) {
        // Log USN and fee ID only — no PII (DPDP Act 2023)
        this.logger.error(
          `[FeeReminder] Failed for usn=${fee.student_usn} feeId=${fee.fee_payment_id}: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(`[FeeReminder] Chain complete. Processed: ${sent}/${fees.length}`);
  }

  private async processReminder(fee: FeeRiskRow): Promise<void> {
    if (!this.db) return;

    const dueDate = new Date(fee.due_date).toISOString().slice(0, 10); // YYYY-MM-DD — locale-independent
    const lang = fee.language || 'en';
    const balance = Number(fee.balance);
    const daysLeft = Number(fee.days_to_due);

    // Determine reminder type for today; null means no reminder due today
    let reminderType: string | null = null;
    if (fee.risk_level === 'HIGH') {
      if (daysLeft === 10 || daysLeft === 9) reminderType = 'WHATSAPP_10D';
      else if (daysLeft === 5 || daysLeft === 4) reminderType = 'CALL_5D';
      else if (daysLeft <= 1 && daysLeft >= 0) reminderType = 'CALL_1D';
    } else if (fee.risk_level === 'MEDIUM') {
      if (daysLeft === 5 || daysLeft === 4) reminderType = 'WHATSAPP_10D';
      else if (daysLeft <= 1 && daysLeft >= 0) reminderType = 'SMS_2D';
    } else {
      // LOW risk
      if (daysLeft === 2 || daysLeft === 1) reminderType = 'SMS_2D';
    }

    if (!reminderType) return;

    const reminderId = randomUUID();
    const channel =
      reminderType.startsWith('CALL') ? 'VOICE' :
      reminderType.startsWith('SMS') ? 'SMS' : 'WHATSAPP';

    // Atomic claim via INSERT ON CONFLICT DO NOTHING — race-safe dedup
    // The partial unique index idx_fee_reminder_dedup covers (fee_payment_id, reminder_type) WHERE status != 'FAILED'
    const inserted = await this.db.query<{ id: string }[]>(
      `INSERT INTO fee_reminders (id, student_usn, fee_payment_id, reminder_type, channel, status)
       VALUES ($1, $2, $3, $4, $5, 'SENT')
       ON CONFLICT (fee_payment_id, reminder_type) WHERE status != 'FAILED' DO NOTHING
       RETURNING id`,
      [reminderId, fee.student_usn, fee.fee_payment_id, reminderType, channel],
    );

    if (!inserted.length) {
      // Another process already claimed this slot — skip (DPDP: no double-sending)
      this.logger.debug(`[FeeReminder] Dedup: ${reminderType} already sent for feeId=${fee.fee_payment_id}`);
      return;
    }

    try {
      if (channel === 'WHATSAPP') {
        const tmpl = WA_TEMPLATES[lang] ?? WA_TEMPLATES['en'];
        await this.messaging.sendWhatsApp(fee.parent_phone, tmpl(fee.student_name, balance, dueDate, daysLeft));
      } else if (channel === 'VOICE') {
        await this.messaging.triggerFeeCall(
          fee.student_usn,
          fee.parent_phone,
          lang,
          { feeType: fee.fee_type, balance, dueDate },
        );
      } else {
        const tmpl = SMS_TEMPLATES[lang] ?? SMS_TEMPLATES['en'];
        await this.messaging.sendSms(fee.parent_phone, tmpl(fee.student_name, balance, dueDate));
      }
      // Log fee ID + USN only — no phone number (DPDP Act 2023 data minimisation)
      this.logger.log(
        `[FeeReminder] ${reminderType} dispatched for usn=${fee.student_usn} feeId=${fee.fee_payment_id} balance=₹${balance}`,
      );
    } catch (err) {
      const notes = ((err as Error).message ?? '').slice(0, 500); // truncate — Twilio errors may contain account IDs
      await this.db.query(
        `UPDATE fee_reminders SET status = 'FAILED', notes = $2 WHERE id = $1`,
        [inserted[0].id, notes],
      );
      throw err;
    }
  }

  // Admin "Call Now" — rate-limited: one manual call per fee per 10 minutes
  async triggerManualCall(feePaymentId: string): Promise<{ message: string }> {
    if (!this.db) throw new Error('Database not configured');

    const rows = await this.db.query<FeeRiskRow[]>(
      `SELECT * FROM fee_risk_scores WHERE fee_payment_id = $1`,
      [feePaymentId],
    );
    if (!rows.length) throw new Error('Fee record not found in risk view');

    const fee = rows[0];
    const dueDate = new Date(fee.due_date).toISOString().slice(0, 10);

    // Atomic dedup with 10-minute cooldown — prevents admin click-spam
    const reminderId = randomUUID();
    const inserted = await this.db.query<{ id: string }[]>(
      `INSERT INTO fee_reminders (id, student_usn, fee_payment_id, reminder_type, channel, status)
       SELECT $1, $2, $3, 'MANUAL_CALL', 'VOICE', 'SENT'
       WHERE NOT EXISTS (
         SELECT 1 FROM fee_reminders
         WHERE fee_payment_id = $3
           AND reminder_type = 'MANUAL_CALL'
           AND status != 'FAILED'
           AND sent_at > NOW() - INTERVAL '10 minutes'
       )
       RETURNING id`,
      [reminderId, fee.student_usn, feePaymentId],
    );

    if (!inserted.length) {
      return { message: 'A call was already initiated within the last 10 minutes' };
    }

    try {
      await this.messaging.triggerFeeCall(
        fee.student_usn,
        fee.parent_phone,
        fee.language || 'en',
        { feeType: fee.fee_type, balance: Number(fee.balance), dueDate },
      );
    } catch (err) {
      const notes = ((err as Error).message ?? '').slice(0, 500);
      await this.db.query(
        `UPDATE fee_reminders SET status = 'FAILED', notes = $2 WHERE id = $1`,
        [inserted[0].id, notes],
      );
      throw err;
    }

    // No PII in response (DPDP Act 2023) — return only a non-identifying message
    return { message: 'Call initiated successfully' };
  }

  async getDashboardSummary(): Promise<Record<string, unknown>> {
    if (!this.db) return {};
    const rows = await this.db.query(`
      SELECT
        COUNT(*)                                     AS total_outstanding_count,
        COALESCE(SUM(balance), 0)                    AS total_outstanding_amount,
        COUNT(*) FILTER (WHERE risk_level = 'HIGH')  AS high_risk_count,
        COALESCE(SUM(balance) FILTER (WHERE risk_level = 'HIGH'), 0)   AS high_risk_amount,
        COUNT(*) FILTER (WHERE risk_level = 'MEDIUM') AS medium_risk_count,
        COALESCE(SUM(balance) FILTER (WHERE risk_level = 'MEDIUM'), 0) AS medium_risk_amount,
        COUNT(*) FILTER (WHERE risk_level = 'LOW')   AS low_risk_count,
        COALESCE(SUM(balance) FILTER (WHERE risk_level = 'LOW'), 0)    AS low_risk_amount,
        COUNT(*) FILTER (WHERE days_to_due < 0)      AS overdue_count,
        COALESCE(SUM(balance) FILTER (WHERE days_to_due < 0), 0)       AS overdue_amount,
        COALESCE(SUM(balance) FILTER (WHERE risk_level = 'HIGH'), 0)   AS predicted_at_risk_amount
      FROM fee_risk_scores
    `);
    return rows[0] as Record<string, unknown>;
  }

  async getOutstandingFees(filters: {
    riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
    department?: string;
    overdueOnly?: boolean;
    limit?: number;
  }): Promise<FeeRiskRow[]> {
    if (!this.db) return [];

    let q = `SELECT * FROM fee_risk_scores WHERE 1=1`;
    const params: unknown[] = [];
    let i = 1;

    if (filters.overdueOnly) q += ` AND days_to_due < 0`;
    if (filters.riskLevel)   { q += ` AND risk_level = $${i++}`;  params.push(filters.riskLevel); }
    if (filters.department)  { q += ` AND department = $${i++}`;  params.push(filters.department); }

    const limit = Math.min(filters.limit ?? 100, 500); // cap at 500
    q += ` ORDER BY risk_score DESC LIMIT $${i}`;
    params.push(limit);

    return this.db.query(q, params);
  }

  async getReminderHistory(feePaymentId: string): Promise<unknown[]> {
    if (!this.db) return [];
    return this.db.query(
      `SELECT id, reminder_type, channel, status, sent_at, notes
       FROM fee_reminders
       WHERE fee_payment_id = $1
       ORDER BY sent_at DESC
       LIMIT 200`,
      [feePaymentId],
    );
  }
}
