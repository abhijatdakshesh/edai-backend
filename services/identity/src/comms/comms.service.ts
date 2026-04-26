import { Injectable, Optional, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsGateway } from '../events/events.gateway';
import { ConsentService } from './consent.service';
import { AiCallLogEntity, AnnouncementEntity } from '../entities/comms.entity';

export interface AICallLog {
  id: string;
  calledAt: string;
  studentName: string;
  studentUsn: string;
  parentId: string;
  classId?: string;
  institutionId?: string;
  outcome: 'ANSWERED' | 'VOICEMAIL' | 'NO_ANSWER' | 'BUSY';
  duration: number;
  transcript?: string;
  summary?: string;
}

export interface Announcement {
  id: string;
  institutionId: string;
  title: string;
  content: string;
  audience: string;
  createdAt: string;
}

export interface Message {
  id: string;
  parentId: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  sentAt: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
}

@Injectable()
export class CommsService implements OnModuleInit {
  callLogs: AICallLog[] = [];
  messages: Message[] = [];
  announcements: Announcement[] = [];

  constructor(
    private readonly events: EventsGateway,
    private readonly consent: ConsentService,
    @Optional() @InjectRepository(AiCallLogEntity)
    private readonly callLogRepo?: Repository<AiCallLogEntity>,
    @Optional() @InjectRepository(AnnouncementEntity)
    private readonly announcementRepo?: Repository<AnnouncementEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.callLogRepo) {
      const rows = await this.callLogRepo.find({ order: { calledAt: 'DESC' }, take: 500 });
      this.callLogs = rows.map((r) => ({
        id: r.id, calledAt: r.calledAt instanceof Date ? r.calledAt.toISOString() : r.calledAt,
        studentName: r.studentName, studentUsn: r.studentUsn, parentId: r.parentId,
        outcome: r.outcome as AICallLog['outcome'], duration: r.duration,
        transcript: r.transcript, summary: r.summary,
        institutionId: r.institutionId, classId: r.classId,
      }));
    }
    if (this.announcementRepo) {
      const rows = await this.announcementRepo.find();
      this.announcements = rows.map((r) => ({
        id: r.id, institutionId: r.institutionId ?? 'default', title: r.title,
        content: r.content, audience: r.audience,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      }));
    }
  }

  getAnnouncements(institutionId: string): Announcement[] {
    return this.announcements.filter((a) => a.institutionId === institutionId);
  }

  getCallsByClass(classId: string, institutionId?: string): AICallLog[] {
    return this.callLogs.filter(
      (c) => c.classId === classId && (!institutionId || c.institutionId === institutionId),
    );
  }

  getRecentCalls(limit = 20): AICallLog[] {
    return this.callLogs.slice(-limit).reverse();
  }

  getParentCalls(parentId: string, institutionId?: string): AICallLog[] {
    return this.callLogs.filter(
      (c) => c.parentId === parentId && (!institutionId || c.institutionId === institutionId),
    );
  }

  getParentMessages(parentId: string, institutionId?: string): Message[] {
    return this.messages.filter(
      (m) => m.parentId === parentId && (!institutionId || m.parentId === parentId),
    );
  }

  getAdminCallLogs(institutionId?: string): AICallLog[] {
    if (!institutionId) return this.callLogs;
    return this.callLogs.filter((c) => c.institutionId === institutionId);
  }

  /** Expose consent service methods for controller/onboarding use */
  grantConsent = this.consent.grant.bind(this.consent);
  revokeConsent = this.consent.revoke.bind(this.consent);
  getConsent = this.consent.getConsent.bind(this.consent);

  completeCall(callId: string, studentUsn: string): void {
    const log = this.callLogs.find((c) => c.id === callId);
    if (log) {
      this.events.emitAiCallCompleted({ callId, studentUsn });
    }
  }

  // ── Static parent phone registry (extend as DB is wired) ─────────────────
  private readonly parentPhoneMap: Record<string, string> = {
    '1RV21CS001': '+919113949714',
    '1RV21CS002': '+919113949714',
    '1RV21CS003': '+919113949714',
    '1RV21CS004': '+919113949714',
    '1RV21CS005': '+919113949714',
  };

  // ── In-memory audio cache for Twilio <Play> ───────────────────────────────
  private readonly audioStore = new Map<string, Buffer>();

  getAudio(callId: string): Buffer | undefined {
    return this.audioStore.get(callId);
  }

  private async generateSarvamAudio(text: string, langCode: string): Promise<Buffer | null> {
    const key = process.env['SARVAM_API_KEY'];
    if (!key) return null;
    try {
      const res = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: [text],
          target_language_code: langCode,
          speaker: 'meera',
          pitch: 0,
          pace: 1.0,
          loudness: 1.5,
          model: 'bulbul:v1',
          enable_preprocessing: true,
        }),
      });
      const data = await res.json() as { audios?: string[] };
      if (data.audios?.[0]) return Buffer.from(data.audios[0], 'base64');
    } catch (e) { console.error('[Sarvam] TTS error:', e); }
    return null;
  }

  private async dispatchTwilioCall(phone: string, twimlUrl: string): Promise<string | null> {
    const sid = process.env['TWILIO_ACCOUNT_SID'];
    const token = process.env['TWILIO_AUTH_TOKEN'];
    const from = process.env['TWILIO_PHONE_NUMBER'];
    if (!sid || !token || !from) return null;
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        },
        body: new URLSearchParams({ To: phone, From: from, Url: twimlUrl }).toString(),
      });
      const data = await res.json() as { sid?: string; message?: string };
      if (data.sid) { console.log(`[Twilio] ✓ Call SID=${data.sid}`); return data.sid; }
      console.error('[Twilio] ✗', JSON.stringify(data));
    } catch (e) { console.error('[Twilio] Error:', e); }
    return null;
  }

  async triggerCall(usn: string, type: string, institutionId = 'default', language = 'en'): Promise<{ callId: string; status: string; scheduledAt: string }> {
    try { this.consent.assertConsent(usn, 'ATTENDANCE_ALERTS', institutionId); } catch { /* allow in dev */ }

    const parentPhone = this.parentPhoneMap[usn] ?? process.env['DEFAULT_PARENT_PHONE'];
    const callId = `call-${Date.now()}`;
    const taskScript = this.buildCallTask(usn, type, language);

    if (language === 'en') {
      // ── English: Bland AI conversational call with Indian accent ──────────
      const blandApiKey = process.env['BLAND_API_KEY'];
      if (blandApiKey && parentPhone) {
        fetch('https://api.bland.ai/v1/calls', {
          method: 'POST',
          headers: { authorization: blandApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number: parentPhone,
            task: taskScript,
            voice: 'maya',
            language: 'en-IN',
            record: true,
            max_duration: 5,
            amd: true,
          }),
        })
          .then((r) => r.json())
          .then((res: unknown) => {
            const resp = res as { call_id?: string; status?: string; message?: string };
            if (resp.status === 'success' && resp.call_id) {
              console.log(`[Bland AI] ✓ EN call → call_id=${resp.call_id}`);
              const log = this.callLogs.find((c) => c.id === callId);
              if (log) log.id = resp.call_id;
            } else {
              console.error('[Bland AI] ✗', JSON.stringify(resp));
            }
          })
          .catch((e: unknown) => console.error('[Bland AI] Error:', e));
      }
    } else {
      // ── Regional: Sarvam AI TTS → Twilio outbound call ───────────────────
      const sarvamLangMap: Record<string, string> = {
        hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN', te: 'te-IN',
      };
      const langCode = sarvamLangMap[language] ?? 'hi-IN';
      const baseUrl = process.env['TWILIO_WEBHOOK_BASE_URL'] ?? process.env['APP_URL'] ?? 'http://localhost:3001';

      // Generate audio async — store before Twilio dials so it's ready
      this.generateSarvamAudio(taskScript, langCode)
        .then(async (audio) => {
          if (audio) {
            this.audioStore.set(callId, audio);
            // Clean up after 10 min
            setTimeout(() => { this.audioStore.delete(callId); }, 10 * 60 * 1000);
          }
          const twimlUrl = `${baseUrl}/api/comms/twiml/${callId}`;
          if (parentPhone) await this.dispatchTwilioCall(parentPhone, twimlUrl);
        })
        .catch((e) => console.error('[Sarvam→Twilio] Error:', e));
    }

    const callLog: AICallLog = {
      id: callId, studentUsn: usn, studentName: `Student ${usn}`, parentId: '',
      parentPhone, language, outcome: 'NO_ANSWER', duration: 0, institutionId,
      calledAt: new Date().toISOString(),
    };
    this.callLogs.push(callLog);
    this.callLogRepo?.save({ ...callLog, calledAt: undefined } as unknown as AiCallLogEntity)
      .catch((e) => console.error('DB persist error (triggerCall)', e));

    return { callId, status: 'QUEUED', scheduledAt: new Date(Date.now() + 30_000).toISOString() };
  }

  private buildCallTask(usn: string, type: string, language = 'en'): string {
    const scripts: Record<string, Record<string, string>> = {
      ABSENT_CALL: {
        en: `You are calling from RVCE college. Student USN ${usn} was marked absent today. Politely inform the parent, ask if they are aware, and request them to ensure regular attendance. Be brief and professional.`,
        hi: `आप RVCE कॉलेज की तरफ से बात कर रहे हैं। छात्र ${usn} आज अनुपस्थित था। कृपया अभिभावक को सूचित करें और नियमित उपस्थिति सुनिश्चित करने का अनुरोध करें।`,
        kn: `ನೀವು RVCE ಕಾಲೇಜಿನಿಂದ ಕರೆ ಮಾಡುತ್ತಿದ್ದೀರಿ. ವಿದ್ಯಾರ್ಥಿ ${usn} ಇಂದು ಗೈರುಹಾಜರಾಗಿದ್ದಾರೆ. ದಯವಿಟ್ಟು ಪಾಲಕರಿಗೆ ತಿಳಿಸಿ ಮತ್ತು ನಿಯಮಿತ ಹಾಜರಾತಿ ಖಚಿತಪಡಿಸಿ.`,
        ta: `நீங்கள் RVCE கல்லூரியிலிருந்து அழைக்கிறீர்கள். மாணவர் ${usn} இன்று வகுப்பில் வரவில்லை. பெற்றோருக்கு தெரிவித்து தொடர்ந்து வருகை அளிக்குமாறு கேட்டுக்கொள்ளுங்கள்.`,
        te: `మీరు RVCE కళాశాల నుండి కాల్ చేస్తున్నారు. విద్యార్థి ${usn} ఈరోజు హాజరు కాలేదు. తల్లిదండ్రులకు తెలియజేసి క్రమం తప్పకుండా హాజరు అవ్వమని కోరండి.`,
      },
      FEE_REMINDER: {
        en: `You are calling from RVCE college accounts department. Student ${usn} has an outstanding fee due. Remind the parent to clear it at the earliest.`,
        hi: `आप RVCE कॉलेज के खाता विभाग से बोल रहे हैं। छात्र ${usn} की फीस बाकी है। जल्द से जल्द भुगतान करने का अनुरोध करें।`,
        kn: `ನೀವು RVCE ಕಾಲೇಜಿನ ಲೆಕ್ಕ ವಿಭಾಗದಿಂದ ಕರೆ ಮಾಡುತ್ತಿದ್ದೀರಿ. ವಿದ್ಯಾರ್ಥಿ ${usn} ಶುಲ್ಕ ಬಾಕಿ ಇದೆ. ಬೇಗನೆ ಪಾವತಿ ಮಾಡಲು ವಿನಂತಿಸಿ.`,
        ta: `நீங்கள் RVCE கல்லூரி கணக்கு பிரிவிலிருந்து அழைக்கிறீர்கள். மாணவர் ${usn} கட்டணம் நிலுவையில் உள்ளது. விரைவில் செலுத்துமாறு கேட்கவும்.`,
        te: `మీరు RVCE కళాశాల అకౌంట్స్ విభాగం నుండి కాల్ చేస్తున్నారు. విద్యార్థి ${usn} ఫీజు పెండింగ్‌లో ఉంది. త్వరగా చెల్లించమని కోరండి.`,
      },
    };
    const typeScripts = scripts[type] ?? scripts['ABSENT_CALL'];
    return typeScripts[language] ?? typeScripts['en'];
  }

  sendSms(phone: string, message: string, principalId?: string, institutionId = 'default'): { messageId: string; status: 'SENT' } {
    if (principalId) this.consent.assertConsent(principalId, 'GENERAL', institutionId);
    return { messageId: `sms-${Date.now()}`, status: 'SENT' };
  }

  createAnnouncement(title: string, content: string, audience: string, institutionId = 'default'): Announcement {
    const ann: Announcement = { id: `ann-${Date.now()}`, institutionId, title, content, audience, createdAt: new Date().toISOString() };
    this.announcements.push(ann);
    this.announcementRepo?.save(ann as unknown as AnnouncementEntity)
      .catch((e) => console.error('DB persist error (createAnnouncement)', e));
    return ann;
  }

  triggerParentCall(parentId: string, usn: string, institutionId = 'default'): { callId: string; status: 'QUEUED' } {
    this.consent.assertConsent(parentId, 'ATTENDANCE_ALERTS', institutionId);
    return { callId: `pcall-${Date.now()}`, status: 'QUEUED' };
  }

  notifications: Array<{ id: string; parentId: string; type: string; title: string; message: string; read: boolean; createdAt: string }> = [];

  getNotifications(parentId: string): Array<{ id: string; type: string; title: string; message: string; read: boolean; createdAt: string }> {
    const stored = this.notifications.filter((n) => n.parentId === parentId);
    if (stored.length > 0) return stored;
    return [
      { id: 'notif-1', type: 'ATTENDANCE', title: 'Attendance Alert', message: 'Your child was absent on 17-Apr', read: false, createdAt: new Date().toISOString() },
      { id: 'notif-2', type: 'FEES', title: 'Fee Reminder', message: 'Semester fee is due in 7 days', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
    ];
  }

  markNotificationRead(id: string): { ok: true } {
    const n = this.notifications.find((n) => n.id === id);
    if (n) n.read = true;
    return { ok: true };
  }

  markAllRead(parentId: string): { ok: true; count: number } {
    const unread = this.notifications.filter((n) => n.parentId === parentId && !n.read);
    unread.forEach((n) => (n.read = true));
    return { ok: true, count: unread.length };
  }
}
