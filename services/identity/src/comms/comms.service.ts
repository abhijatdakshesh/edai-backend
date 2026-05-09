import { Injectable, Optional, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsGateway } from '../events/events.gateway';
import { ConsentService } from './consent.service';
import { ConversationStateService, Turn } from './conversation-state.service';
import { KnowledgeGraphService } from '../chatbot/knowledge-graph.service';
import { geminiGenerate, GEMINI_FAST } from '../shared/gemini-ai';
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
  parentPhone?: string;
  language?: string;
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

// ── Interactive-call defaults ────────────────────────────────────────────────
const BCP47: Record<string, string> = {
  en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN',
};
const SARVAM_LANG: Record<string, string> = {
  hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN', te: 'te-IN',
};
const POLLY_VOICE_EN = 'Polly.Aditi-Neural';
const MAX_TURNS = 6;
const MAX_DURATION_MS = 4 * 60 * 1000;
const STOP_INTENTS = /(stop|unsubscribe|cancel|no thanks|ಸಾಕು|बंद|रोको|நிறுத்து|ஆபు|ఆపు|वापस)/i;
const GOODBYE_BY_LANG: Record<string, string> = {
  en: 'Thank you for your time. Goodbye.',
  hi: 'आपके समय के लिए धन्यवाद। नमस्ते।',
  kn: 'ಸಮಯಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ನಮಸ್ಕಾರ.',
  ta: 'நேரத்திற்கு நன்றி. வணக்கம்.',
  te: 'మీ సమయానికి ధన్యవాదాలు. వీడ్కోలు.',
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function trimToWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= n) return text.trim();
  return words.slice(0, n).join(' ');
}

@Injectable()
export class CommsService implements OnModuleInit {
  callLogs: AICallLog[] = [];
  messages: Message[] = [];
  announcements: Announcement[] = [];

  constructor(
    private readonly events: EventsGateway,
    private readonly consent: ConsentService,
    @Optional() private readonly conversation?: ConversationStateService,
    @Optional() private readonly knowledgeGraph?: KnowledgeGraphService,
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

  // ── In-memory audio cache for Twilio <Play>. Keyed by `${callId}` (greeting)
  //    or `${callId}:${turnIdx}` (subsequent AI turns). ─────────────────────
  private readonly audioStore = new Map<string, Buffer>();

  getAudio(key: string): Buffer | undefined {
    return this.audioStore.get(key);
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
          speaker: 'pavithra',
          pitch: 0,
          pace: 1.0,
          loudness: 1.5,
          target_sample_rate: 8000,
          model: 'bulbul:v2',
          enable_preprocessing: true,
        }),
      });
      const data = await res.json() as { audios?: string[] };
      if (data.audios?.[0]) return Buffer.from(data.audios[0], 'base64');
    } catch (e) { console.error('[Sarvam] TTS error:', e); }
    return null;
  }

  private async dispatchTwilioCall(phone: string, twimlUrl: string, statusCallbackUrl?: string): Promise<string | null> {
    const sid = process.env['TWILIO_ACCOUNT_SID'];
    const token = process.env['TWILIO_AUTH_TOKEN'];
    const from = process.env['TWILIO_PHONE_NUMBER'];
    if (!sid || !token || !from) return null;
    try {
      const params: Record<string, string> = { To: phone, From: from, Url: twimlUrl };
      if (statusCallbackUrl) {
        params['StatusCallback'] = statusCallbackUrl;
        params['StatusCallbackEvent'] = 'completed';
        params['StatusCallbackMethod'] = 'POST';
      }
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        },
        body: new URLSearchParams(params).toString(),
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
    const greeting = this.buildCallTask(usn, type, language);

    // Initialize conversation state (in-memory; HORIZONTAL_SCALE_GAP)
    this.conversation?.init(callId, {
      usn,
      language,
      callType: type,
      institutionId,
      parentPhone,
    });

    // Fire-and-forget knowledge graph build so per-turn handler has context.
    if (this.knowledgeGraph) {
      this.knowledgeGraph
        .buildStudentGraph(usn)
        .then((kg) => this.conversation?.setKnowledgeGraph(callId, kg))
        .catch((e) => console.error('[KnowledgeGraph] build error:', e));
    }

    const baseUrl = process.env['TWILIO_WEBHOOK_BASE_URL'] ?? process.env['APP_URL'] ?? 'http://localhost:3001';
    const twimlUrl = `${baseUrl}/api/comms/twiml/${callId}`;
    const statusUrl = `${baseUrl}/api/comms/twiml/${callId}/status`;

    if (language === 'en') {
      // English: TwiML uses <Say voice="Polly.Aditi-Neural">. No pre-gen audio.
      // Push greeting as turn 0 immediately so transcript is populated.
      this.conversation?.pushTurn(callId, 'AI', greeting, language);
      this.events.emitAiCallTurn({
        callId, turn: 0, role: 'AI', text: greeting, language,
        ts: new Date().toISOString(), institutionId,
      });
      if (parentPhone) {
        void this.dispatchTwilioCall(parentPhone, twimlUrl, statusUrl);
      }
    } else {
      // Regional: pre-gen Sarvam audio for the greeting.
      const langCode = SARVAM_LANG[language] ?? 'hi-IN';
      // Pre-record greeting transcript turn so the FE sees it instantly.
      this.conversation?.pushTurn(callId, 'AI', greeting, language);
      this.events.emitAiCallTurn({
        callId, turn: 0, role: 'AI', text: greeting, language,
        ts: new Date().toISOString(), institutionId,
      });
      this.generateSarvamAudio(greeting, langCode)
        .then(async (audio) => {
          if (audio) {
            this.audioStore.set(callId, audio);
            setTimeout(() => { this.audioStore.delete(callId); }, 10 * 60 * 1000);
          }
          if (parentPhone) await this.dispatchTwilioCall(parentPhone, twimlUrl, statusUrl);
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

  // ── Interactive-turn handler ────────────────────────────────────────────
  /**
   * Process a Twilio <Gather> webhook for a turn.
   * Returns TwiML string for the next prompt or hangup.
   */
  async handleTurn(callId: string, speechResult: string, _callStatus?: string): Promise<string> {
    const baseUrl = process.env['TWILIO_WEBHOOK_BASE_URL'] ?? process.env['APP_URL'] ?? 'http://localhost:3001';
    const state = this.conversation?.get(callId);
    if (!state) return this.hangupTwiml('Call session expired.');

    const language = state.language;
    const langTag = BCP47[language] ?? 'en-IN';
    const goodbye = GOODBYE_BY_LANG[language] ?? GOODBYE_BY_LANG['en'];

    // Push parent turn
    const parentText = (speechResult ?? '').trim();
    if (parentText) {
      const parentTurn = this.conversation?.pushTurn(callId, 'PARENT', parentText, language);
      if (parentTurn) {
        this.events.emitAiCallTurn({
          callId, turn: parentTurn.turn, role: 'PARENT', text: parentText, language,
          ts: parentTurn.ts, institutionId: state.institutionId,
        });
      }
    }

    // Stop intent → polite goodbye + hangup
    if (parentText && STOP_INTENTS.test(parentText)) {
      return this.goodbyeTwiml(callId, language, goodbye, state.institutionId);
    }

    // Cap check (turns or duration)
    const turnCount = this.conversation?.count(callId) ?? 0;
    const elapsed = Date.now() - state.startedAt;
    if (turnCount >= MAX_TURNS * 2 || elapsed > MAX_DURATION_MS) {
      return this.goodbyeTwiml(callId, language, goodbye, state.institutionId);
    }

    // Mid-call consent revoke check (graceful — no throw)
    if (!this.consent.hasConsent(state.usn, 'VOICE', state.institutionId)) {
      // Only block if a record exists with VOICE missing AND call was previously ok.
      // For demo: allow when no record exists at all (matches existing dev pattern).
      const consentRecord = this.consent.getConsent(state.usn, state.institutionId);
      if (consentRecord && !consentRecord.channels.includes('VOICE')) {
        return this.goodbyeTwiml(callId, language, goodbye, state.institutionId);
      }
    }

    // Generate AI reply via Gemini (≤25 words)
    let aiReply = '';
    try {
      const prompt = this.buildSystemPrompt(state.turns.slice(-4), parentText, state);
      const raw = await geminiGenerate(prompt, GEMINI_FAST, 200);
      aiReply = trimToWords(raw, 25);
    } catch (e) {
      console.error('[Gemini] turn error:', e);
      aiReply = goodbye;
    }
    if (!aiReply) aiReply = goodbye;

    const aiTurn = this.conversation?.pushTurn(callId, 'AI', aiReply, language);
    if (aiTurn) {
      this.events.emitAiCallTurn({
        callId, turn: aiTurn.turn, role: 'AI', text: aiReply, language,
        ts: aiTurn.ts, institutionId: state.institutionId,
      });
    }
    const turnIdx = aiTurn?.turn ?? 0;

    // Build TwiML: <Play> for regional (with Sarvam audio), <Say> for English.
    let speakXml: string;
    if (language === 'en') {
      speakXml = `<Say voice="${POLLY_VOICE_EN}" language="en-IN">${escapeXml(aiReply)}</Say>`;
    } else {
      const langCode = SARVAM_LANG[language] ?? 'hi-IN';
      const audio = await this.generateSarvamAudio(aiReply, langCode);
      const audioKey = `${callId}:${turnIdx}`;
      if (audio) {
        this.audioStore.set(audioKey, audio);
        setTimeout(() => { this.audioStore.delete(audioKey); }, 10 * 60 * 1000);
        speakXml = `<Play>${baseUrl}/api/comms/audio/${encodeURIComponent(audioKey)}</Play>`;
      } else {
        // Fallback to Polly if Sarvam fails
        speakXml = `<Say voice="${POLLY_VOICE_EN}" language="${langTag}">${escapeXml(aiReply)}</Say>`;
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response>${speakXml}` +
      `<Gather input="speech" speechTimeout="auto" timeout="6" language="${langTag}" ` +
      `action="${baseUrl}/api/comms/twiml/${callId}/turn" method="POST"></Gather></Response>`;
  }

  private goodbyeTwiml(callId: string, language: string, goodbye: string, _institutionId: string): string {
    const langTag = BCP47[language] ?? 'en-IN';
    const speakXml = language === 'en'
      ? `<Say voice="${POLLY_VOICE_EN}" language="en-IN">${escapeXml(goodbye)}</Say>`
      : `<Say language="${langTag}">${escapeXml(goodbye)}</Say>`;
    // Note: finalizeCall is invoked by Twilio status callback; we just hangup here.
    void callId;
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${speakXml}<Hangup/></Response>`;
  }

  private hangupTwiml(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`;
  }

  private buildSystemPrompt(recentTurns: Turn[], parentText: string, state: { usn: string; language: string; callType: string; knowledgeGraph?: unknown }): string {
    const kgJson = state.knowledgeGraph ? JSON.stringify(state.knowledgeGraph).slice(0, 1500) : '{}';
    const transcript = recentTurns.map(t => `${t.role}: ${t.text}`).join('\n');
    return [
      `You are EdAI, calling on behalf of RV College of Engineering, Bengaluru.`,
      `Speak in language code: ${state.language}.`,
      `Student USN: ${state.usn}. Reason for call: ${state.callType}.`,
      `Context (knowledge graph JSON): ${kgJson}`,
      `Recent transcript:\n${transcript}`,
      `Parent just said: ${parentText || '(no input)'}`,
      `Reply in ${state.language}, ≤25 words. Always end with a question or polite goodbye.`,
      `Never mention you are an AI unless asked. If parent says stop/no/unsubscribe, say goodbye and end.`,
    ].join('\n\n');
  }

  /** Twilio status callback handler — write final transcript + summary, evict state. */
  async finalizeCall(callId: string, twilioStatus?: string): Promise<void> {
    const state = this.conversation?.get(callId);
    if (!state) return;

    const log = this.callLogs.find((c) => c.id === callId);
    const outcomeMap: Record<string, AICallLog['outcome']> = {
      'completed': 'ANSWERED',
      'no-answer': 'NO_ANSWER',
      'busy': 'BUSY',
      'failed': 'NO_ANSWER',
    };
    const outcome = outcomeMap[twilioStatus ?? 'completed'] ?? 'ANSWERED';

    // DPDP gate: only persist transcript if VOICE consent exists (when any consent record present).
    const consentRecord = this.consent.getConsent(state.usn, state.institutionId);
    const persistTranscript = !consentRecord || consentRecord.channels.includes('VOICE');

    let transcript: string | undefined;
    let summary: string | undefined;
    if (persistTranscript && state.turns.length > 0) {
      transcript = JSON.stringify(state.turns);
      try {
        const summaryPrompt =
          `Summarize this voice call transcript in one line (≤30 words), in English:\n` +
          state.turns.map(t => `${t.role}: ${t.text}`).join('\n');
        const raw = await geminiGenerate(summaryPrompt, GEMINI_FAST, 120);
        summary = trimToWords(raw, 30);
      } catch (e) {
        console.error('[Gemini] summary error:', e);
      }
    }

    if (log) {
      log.outcome = outcome;
      log.duration = Math.round((Date.now() - state.startedAt) / 1000);
      if (transcript) log.transcript = transcript;
      if (summary) log.summary = summary;
      this.callLogRepo?.save({ ...log, calledAt: undefined } as unknown as AiCallLogEntity)
        .catch((e) => console.error('DB persist error (finalizeCall)', e));
    }

    this.events.emitAiCallCompleted({
      callId, studentUsn: state.usn, institutionId: state.institutionId,
    });

    // Cleanup audio cache for this call
    for (const key of Array.from(this.audioStore.keys())) {
      if (key === callId || key.startsWith(`${callId}:`)) this.audioStore.delete(key);
    }
    this.conversation?.evict(callId);
  }

  private buildCallTask(usn: string, type: string, language = 'en'): string {
    const scripts: Record<string, Record<string, string>> = {
      ABSENT_CALL: {
        en: `Hello, this is EdAI calling from RVCE. Student ${usn} was marked absent today. Were you aware?`,
        hi: `नमस्ते, यह RVCE से EdAI है। छात्र ${usn} आज अनुपस्थित था। क्या आप जानते हैं?`,
        kn: `ನಮಸ್ಕಾರ, ಇದು RVCE ಯಿಂದ EdAI. ವಿದ್ಯಾರ್ಥಿ ${usn} ಇಂದು ಗೈರುಹಾಜರಾಗಿದ್ದಾರೆ. ನಿಮಗೆ ತಿಳಿದಿತ್ತೇ?`,
        ta: `வணக்கம், இது RVCE இலிருந்து EdAI. மாணவர் ${usn} இன்று வரவில்லை. உங்களுக்குத் தெரியுமா?`,
        te: `నమస్కారం, ఇది RVCE నుండి EdAI. విద్యార్థి ${usn} ఈరోజు హాజరు కాలేదు. మీకు తెలుసా?`,
      },
      FEE_REMINDER: {
        en: `Hello, this is EdAI from RVCE accounts. Student ${usn} has a pending fee. Can you pay this week?`,
        hi: `नमस्ते, यह RVCE से EdAI है। छात्र ${usn} की फीस बाकी है। क्या आप इस हफ्ते भुगतान कर सकते हैं?`,
        kn: `ನಮಸ್ಕಾರ, ಇದು RVCE ಯಿಂದ EdAI. ವಿದ್ಯಾರ್ಥಿ ${usn} ಶುಲ್ಕ ಬಾಕಿ ಇದೆ. ಈ ವಾರದಲ್ಲಿ ಪಾವತಿಸಬಹುದೇ?`,
        ta: `வணக்கம், RVCE இலிருந்து EdAI. மாணவர் ${usn} கட்டணம் நிலுவையில். இந்த வாரம் செலுத்த முடியுமா?`,
        te: `నమస్కారం, RVCE నుండి EdAI. విద్యార్థి ${usn} ఫీజు పెండింగ్‌లో ఉంది. ఈ వారం చెల్లించగలరా?`,
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
