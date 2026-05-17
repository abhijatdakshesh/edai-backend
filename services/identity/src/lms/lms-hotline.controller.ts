import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards, HttpCode, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { LmsService } from './lms.service';
import { CommsService } from '../comms/comms.service';
import { ConversationStateService } from '../comms/conversation-state.service';
import { TwilioWebhookGuard } from '../chatbot/twilio-webhook.guard';
import { geminiGenerate, GEMINI_FAST } from '../shared/gemini-ai';
import { resolveCollegeId } from './tenant-context';

/**
 * Voice-Tutor Hotline (KAN inventor feature).
 *
 * Twilio inbound number → GET /api/lms/hotline/twiml
 *   → Gather digits (IVR menu: 1=OS, 2=DBMS, 3=DSA, 4=DBMS, 0=English)
 * Twilio POSTs digit → /api/lms/hotline/twiml/menu
 *   → seeds ConversationState with course+language, plays course greeting
 * Twilio POSTs speech each turn → /api/lms/hotline/twiml/turn
 *   → fetches lesson context, asks Gemini, replies via Sarvam (regional)
 *     or Polly (English) using the same audio-store + signed-URL pattern
 *     as the parent-call comms pipeline.
 *
 * The "single Twilio number for every RV college" works because the
 * inbound Twilio webhook URL can be appended with ?collegeId=<uuid> per
 * provisioning. resolveCollegeId() picks it up.
 */

const COURSE_MENU: Array<{ digit: string; courseId: string; courseName: string; defaultLang: 'en' | 'kn' | 'hi' }> = [
  { digit: '1', courseId: 'CS501', courseName: 'Operating Systems', defaultLang: 'kn' },
  { digit: '2', courseId: 'CS502', courseName: 'Database Management Systems', defaultLang: 'kn' },
  { digit: '3', courseId: 'CS503', courseName: 'Data Structures', defaultLang: 'kn' },
  { digit: '4', courseId: 'CS504', courseName: 'Computer Networks', defaultLang: 'kn' },
  { digit: '0', courseId: 'CS501', courseName: 'Operating Systems (English)', defaultLang: 'en' },
];

const POLLY_VOICE_EN = 'Polly.Kajal-Neural';
const BCP47: Record<string, string> = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN' };

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

@Controller()
@UseGuards(TwilioWebhookGuard)
export class LmsHotlineController {
  private readonly logger = new Logger(LmsHotlineController.name);

  constructor(
    private readonly lms: LmsService,
    private readonly comms: CommsService,
    private readonly conversation: ConversationStateService,
  ) {}

  /** Twilio fetches this when the inbound call connects. Plays a short
   *  English IVR (always English so any caller can navigate) then gathers
   *  a single digit. */
  @ Get('lms/hotline/twiml')
  ivr(@Req() req: Request, @Res() res: Response): void {
    const baseUrl = process.env['TWILIO_WEBHOOK_BASE_URL'] ?? process.env['APP_URL'] ?? 'http://localhost:3001';
    const greeting =
      'Welcome to the Raycraft AI tutor hotline. ' +
      COURSE_MENU.map((c) => `Press ${c.digit} for ${c.courseName}.`).join(' ') +
      ' You can also speak your question after the beep.';
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response>` +
      `<Gather input="dtmf speech" timeout="6" numDigits="1" speechTimeout="auto" ` +
      `action="${baseUrl}/api/lms/hotline/twiml/menu${req.url.includes('?') ? '&' : '?'}collegeId=${encodeURIComponent(resolveCollegeId(req))}" method="POST">` +
      `<Say voice="${POLLY_VOICE_EN}" language="en-IN">${escXml(greeting)}</Say>` +
      `</Gather>` +
      `<Say voice="${POLLY_VOICE_EN}" language="en-IN">No selection received. Goodbye.</Say>` +
      `<Hangup/>` +
      `</Response>`;
    res.type('text/xml').send(xml);
  }

  /** Handles the IVR digit. Either a digit was pressed (route to course)
   *  or speech was captured directly (treat as turn 1 for the default course). */
  @ Post('lms/hotline/twiml/menu')
  async menu(
    @Req() req: Request,
    @Body() body: { Digits?: string; SpeechResult?: string },
    @Res() res: Response,
  ): Promise<void> {
    const baseUrl = process.env['TWILIO_WEBHOOK_BASE_URL'] ?? process.env['APP_URL'] ?? 'http://localhost:3001';
    const collegeId = resolveCollegeId(req);
    const digit = (body?.Digits ?? '').trim();
    const directSpeech = (body?.SpeechResult ?? '').trim();
    const pick = COURSE_MENU.find((c) => c.digit === digit) ?? COURSE_MENU[0]!;
    const callId = `hot-${randomUUID()}`;
    // Seed conversation state: usn unknown (anonymous inbound), language from menu
    this.conversation.init(callId, {
      usn: 'HOTLINE',
      language: pick.defaultLang,
      callType: `HOTLINE:${pick.courseId}`,
      institutionId: collegeId,
    });
    this.logger.log(`[Hotline] callId=${callId} college=${collegeId} course=${pick.courseId} lang=${pick.defaultLang} directSpeech="${directSpeech.slice(0, 60)}"`);

    // If the user spoke their question directly (instead of pressing a digit),
    // synthesise a turn response and play it; otherwise greet them.
    const xml = await this.buildTurnXml({
      callId,
      collegeId,
      courseId: pick.courseId,
      courseName: pick.courseName,
      language: pick.defaultLang,
      userSpeech: directSpeech,
      baseUrl,
    });
    res.type('text/xml').send(xml);
  }

  /** Subsequent turns — student speaks a question, we reply. */
  @ Post('lms/hotline/twiml/turn/:callId')
  async turn(
    @Param('callId') callId: string,
    @Body() body: { SpeechResult?: string; Digits?: string },
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const baseUrl = process.env['TWILIO_WEBHOOK_BASE_URL'] ?? process.env['APP_URL'] ?? 'http://localhost:3001';
    const collegeId = resolveCollegeId(req);
    const state = this.conversation.get(callId);
    if (!state) {
      // Session expired — politely hang up
      res.type('text/xml').send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${POLLY_VOICE_EN}" language="en-IN">Session timed out. Please call again. Goodbye.</Say><Hangup/></Response>`,
      );
      return;
    }
    const courseId = state.callType.startsWith('HOTLINE:') ? state.callType.slice(8) : 'CS501';
    const courseName = COURSE_MENU.find((c) => c.courseId === courseId)?.courseName ?? courseId;
    const userSpeech = ((body?.SpeechResult ?? '') + ' ' + (body?.Digits ?? '')).trim();
    const xml = await this.buildTurnXml({
      callId,
      collegeId,
      courseId,
      courseName,
      language: state.language as 'en' | 'kn' | 'hi',
      userSpeech,
      baseUrl,
    });
    res.type('text/xml').send(xml);
  }

  /** Twilio status callback — drop the conversation state when the call ends. */
  @ Post('lms/hotline/twiml/status/:callId')
  @ HttpCode(204)
  async statusCallback(@Param('callId') callId: string, @Body() body: { CallStatus?: string }) {
    const status = body?.CallStatus;
    if (status && ['completed', 'failed', 'no-answer', 'busy'].includes(status)) {
      this.conversation.evict(callId);
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private async buildTurnXml(args: {
    callId: string;
    collegeId: string;
    courseId: string;
    courseName: string;
    language: 'en' | 'kn' | 'hi';
    userSpeech: string;
    baseUrl: string;
  }): Promise<string> {
    const { callId, collegeId, courseId, courseName, language, userSpeech, baseUrl } = args;
    const langTag = BCP47[language] ?? 'en-IN';
    const turnAction = `${baseUrl}/api/lms/hotline/twiml/turn/${callId}`;

    // Build a context-aware reply with Gemini. The lesson list of the
    // course is injected as the only authoritative material so replies
    // stay on syllabus.
    const modules = await this.lms.listModules(collegeId, courseId);
    const lessonTitles: string[] = [];
    for (const m of modules.slice(0, 1)) {
      const ls = await this.lms.listLessons(collegeId, m.id);
      lessonTitles.push(...ls.slice(0, 5).map((l) => l.title));
    }

    let replyText = '';
    const question = (userSpeech ?? '').trim();
    if (!question) {
      replyText =
        language === 'kn'
          ? `ನಮಸ್ಕಾರ. ${courseName} ಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ.`
          : language === 'hi'
          ? `नमस्ते। ${courseName} में आपका स्वागत है। कृपया अपना प्रश्न पूछें।`
          : `Hello, welcome to ${courseName}. Please ask your question after the beep.`;
    } else {
      const prompt =
        `You are a phone-based tutor for the course "${courseName}". ` +
        `Reply in ${language} (BCP-47 ${langTag}) only, no English, no Markdown. ` +
        `Keep it under 50 words so it reads naturally aloud. ` +
        `Lessons available: ${lessonTitles.join(', ') || 'general overview'}. ` +
        `Caller said: "${question}".`;
      try {
        replyText = (await geminiGenerate(prompt, GEMINI_FAST, 200)).trim();
      } catch (e) {
        this.logger.warn(`Hotline LLM error: ${(e as Error).message}`);
        replyText =
          language === 'kn'
            ? 'ಕ್ಷಮಿಸಿ, ತಾತ್ಕಾಲಿಕ ಸಮಸ್ಯೆ ಇದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಕೇಳಿ.'
            : 'Sorry, I had trouble processing that. Please try again.';
      }
    }

    // Persist turn for analytics
    this.conversation.pushTurn(callId, 'AI', replyText, language);

    // Build <Play> or <Say> depending on language
    let speakXml: string;
    if (language === 'en') {
      speakXml = `<Say voice="${POLLY_VOICE_EN}" language="en-IN">${escXml(replyText)}</Say>`;
    } else {
      // Sarvam audio: generate + cache in CommsService audio store, play via signed URL
      const audioKey = `${callId}:${Date.now().toString(36)}`;
      const audio = await this.comms.generateSarvamAudioPublic(replyText, langTag).catch(() => null);
      if (audio) {
        this.comms.setAudioPublic(audioKey, audio);
        const playUrl = this.comms.signAudioUrl(audioKey, baseUrl);
        speakXml = `<Play>${escXml(playUrl)}</Play>`;
      } else {
        // Fallback: Polly will read Indic text (low quality but won't break call)
        speakXml = `<Say voice="${POLLY_VOICE_EN}" language="${langTag}">${escXml(replyText)}</Say>`;
      }
    }

    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response>${speakXml}` +
      `<Gather input="speech" speechTimeout="auto" timeout="8" language="${langTag}" ` +
      `action="${turnAction}" method="POST"></Gather>` +
      `<Say voice="${POLLY_VOICE_EN}" language="en-IN">Goodbye.</Say><Hangup/>` +
      `</Response>`
    );
  }
}
