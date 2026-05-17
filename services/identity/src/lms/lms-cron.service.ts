import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LmsService } from './lms.service';
import { CommsService } from '../comms/comms.service';
import { geminiGenerate, GEMINI_FAST } from '../shared/gemini-ai';
import { getCollegeFeatures } from './tenant-context';

/**
 * LMS background jobs.
 *
 *  1. Night-Before Revision Call (Layer 3 inventor #3)
 *     - Cron every hour
 *     - Find students whose next exam is ~18 h away (from timetable / exam window)
 *     - For each, pick their 3 weakest mastered topics and trigger a Twilio call
 *       that quizzes them in their preferred language.
 *     - Gated by college feature flag: lms_revision_call.
 *
 *  2. Weekly Parent Digest (Layer 3 inventor #5)
 *     - Cron every Sunday 18:00
 *     - For each student with parent contact + opt-in: Gemini summarises what
 *       they learned that week, send to parent's preferred channel (WhatsApp /
 *       SMS / voice) in their language via the existing CommsService.
 *     - Gated by college feature flag: lms_parent_digest.
 *
 * Both jobs run idempotently (a per-(usn, day) marker is set in-memory so a
 * re-trigger within the same tick is a no-op). In multi-tenant prod the
 * marker store becomes Redis keyed by (collegeId, usn, day).
 */
@Injectable()
export class LmsCronService {
  private readonly logger = new Logger(LmsCronService.name);
  private readonly revisionCallSent = new Set<string>();
  private readonly digestSent = new Set<string>();

  constructor(
    private readonly lms: LmsService,
    private readonly comms: CommsService,
  ) {}

  // ── Night-Before Revision Call ────────────────────────────────────────

  /** Runs at the top of every hour. In a real deployment the candidate set
   *  is a JOIN over students + exam timetable; here we fan-out the demo
   *  students seeded in CommsService.parentPhoneMap. */
  @Cron(CronExpression.EVERY_HOUR)
  async nightBeforeRevisionCall(): Promise<void> {
    const collegeId = process.env['DEFAULT_COLLEGE_ID'] ?? 'default';
    if (getCollegeFeatures(collegeId)['lms_revision_call'] === false) return;
    const candidates = await this.candidatesForRevisionCall();
    for (const c of candidates) {
      const key = `${c.usn}:${new Date().toISOString().slice(0, 10)}`;
      if (this.revisionCallSent.has(key)) continue;
      this.revisionCallSent.add(key);
      await this.triggerRevisionCall(collegeId, c.usn, c.courseId, c.language).catch((e) =>
        this.logger.warn(`Revision call failed for ${c.usn}: ${(e as Error).message}`),
      );
    }
    if (candidates.length) {
      this.logger.log(`[NightBeforeRevision] dispatched ${candidates.length} call(s)`);
    }
  }

  /** Pulls the 3 weakest mastered topics and dispatches a Twilio call with
   *  a system prompt that quizzes them. Reuses the existing comms.triggerCall
   *  by passing an LMS-specific call type so handleTurn can branch. */
  private async triggerRevisionCall(
    collegeId: string, usn: string, courseId: string, language: string,
  ): Promise<void> {
    const mastery = await this.lms.getMastery(collegeId, usn, courseId);
    const weakest = [...mastery]
      .filter((m) => m.masteryScore < 0.66)
      .sort((a, b) => a.masteryScore - b.masteryScore)
      .slice(0, 3)
      .map((m) => m.topic);
    if (weakest.length === 0) return; // student is already mastered — no call needed
    this.logger.log(`[NightBeforeRevision] ${usn} weakest=${weakest.join(', ')} lang=${language}`);
    // The trigger reuses the comms pipeline. The TYPE prefix tells the
    // per-turn handler to use a quiz-style system prompt.
    await this.comms.triggerCall(
      usn,
      `LMS_REVISION:${courseId}:${weakest.join(',')}`,
      collegeId,
      language,
    );
  }

  /** Demo candidates: the seeded students with phones in CommsService.parentPhoneMap
   *  whose collegeId matches our default. Real impl JOINs exam-timetable
   *  with student preferred_language and only includes students with an
   *  exam in (now + 17h, now + 19h). */
  private async candidatesForRevisionCall(): Promise<
    Array<{ usn: string; courseId: string; language: string }>
  > {
    // No-op in non-prod unless explicitly enabled — prevents stray Twilio
    // charges every hour from local dev / CI runs.
    if (process.env['NODE_ENV'] !== 'production' && process.env['LMS_CRON_ENABLE'] !== 'true') {
      return [];
    }
    return [
      { usn: '1RV21CS001', courseId: 'CS501', language: 'kn' },
      { usn: '1RV21CS006', courseId: 'CS501', language: 'kn' },
    ];
  }

  // ── Weekly Parent Digest ──────────────────────────────────────────────

  /** Every Sunday 18:00 IST → 12:30 UTC. */
  @Cron('30 12 * * SUN')
  async weeklyParentDigest(): Promise<void> {
    const collegeId = process.env['DEFAULT_COLLEGE_ID'] ?? 'default';
    if (getCollegeFeatures(collegeId)['lms_parent_digest'] === false) return;
    const families = await this.familiesForDigest();
    for (const f of families) {
      const weekKey = `${f.usn}:${this.isoWeek(new Date())}`;
      if (this.digestSent.has(weekKey)) continue;
      this.digestSent.add(weekKey);
      try {
        const summary = await this.buildWeeklySummary(collegeId, f.usn, f.language);
        if (!summary) continue;
        // Send via SMS for the demo (existing sendSms path). WhatsApp template
        // wiring is a follow-up once the BSP credentials land.
        this.comms.sendSms(f.parentPhone, summary);
        this.logger.log(`[ParentDigest] sent to ${f.parentPhone} for ${f.usn}`);
      } catch (e) {
        this.logger.warn(`[ParentDigest] ${f.usn} failed: ${(e as Error).message}`);
      }
    }
  }

  private async buildWeeklySummary(
    collegeId: string, usn: string, language: string,
  ): Promise<string> {
    // Gather what the student did this week — checkpoints passed + mastered
    // topics (from the LMS) is the freshest signal for a parent digest.
    const mastery = await this.lms.getMastery(collegeId, usn, 'CS501');
    const mastered = mastery.filter((m) => m.masteryScore >= 0.66).map((m) => m.topic);
    if (mastered.length === 0) return '';
    const prompt =
      `Write an 80-word parent-friendly summary in ${language} of the topics ` +
      `the student mastered this week: ${mastered.join(', ')}. ` +
      `Plain language. End with one concrete suggestion the parent can do at home. ` +
      `Plain text, no Markdown, no formatting.`;
    try {
      return (await geminiGenerate(prompt, GEMINI_FAST, 240)).trim();
    } catch {
      return `Your child mastered ${mastered.length} topic${
        mastered.length === 1 ? '' : 's'
      } this week: ${mastered.join(', ')}. Encourage them to revise once with you.`;
    }
  }

  private async familiesForDigest(): Promise<
    Array<{ usn: string; parentPhone: string; language: string }>
  > {
    if (process.env['NODE_ENV'] !== 'production' && process.env['LMS_CRON_ENABLE'] !== 'true') {
      return [];
    }
    return [
      { usn: '1RV21CS001', parentPhone: '+919113949714', language: 'kn' },
      { usn: '1RV21CS006', parentPhone: '+918700151250', language: 'kn' },
    ];
  }

  /** Manually-triggerable entry points for QA / Jira demos. */
  async runRevisionNow(): Promise<void> { await this.nightBeforeRevisionCall(); }
  async runDigestNow(): Promise<void>   { await this.weeklyParentDigest(); }

  // ── Helpers ────────────────────────────────────────────────────────────

  private isoWeek(d: Date): string {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
}
