import { ForbiddenException, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  LessonEntity, ModuleEntity, LessonProgressEntity, TopicMasteryEntity,
  type LessonContentBlock, type CheckpointQuestion, type ProgressState,
} from '../entities/lms.entity';
import { geminiGenerate, GEMINI_FAST, GEMINI_SMART } from '../shared/gemini-ai';
import { CommsService } from '../comms/comms.service';
import { EventsGateway } from '../events/events.gateway';
import { CoursesService } from '../courses/courses.service';
import {
  LMS_DEMO_COURSE_ID,
  LMS_DEMO_LESSONS,
  LMS_DEMO_MODULE,
  LMS_DEMO_MODULE_ID,
} from './lms-demo-seed';

const SARVAM_LANG: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN', te: 'te-IN',
};

export interface ModuleSummary {
  id: string;
  collegeId: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  published: boolean;
  lessonCount: number;
}

export interface LessonView {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  contentBlocks: LessonContentBlock[];
  checkpoint: CheckpointQuestion[];
  topicTags: string[];
  published: boolean;
  progress?: { state: ProgressState; score: number };
}

/** Top-level LMS service. Uses in-memory fallback when DATABASE_URL is unset
 *  so demos work without a Postgres instance. */
export interface LmsListOptions {
  /** When true, only published modules/lessons are returned (student-facing). */
  publishedOnly?: boolean;
}

@Injectable()
export class LmsService implements OnModuleInit {
  private readonly logger = new Logger(LmsService.name);

  // In-memory fallbacks (used when repos not provided in non-DB envs)
  private readonly memModules: ModuleEntity[] = [];
  private readonly memLessons: LessonEntity[] = [];
  private readonly memProgress: LessonProgressEntity[] = [];
  private readonly memMastery: TopicMasteryEntity[] = [];
  // Cache for ELI5 + narration text rewrites: key = `${lessonId}:${level}` or `${lessonId}:${lang}`
  private readonly textCache = new Map<string, string>();

  /** Mutable view of the injected repos. Set to undefined per-repo if the
   *  underlying Postgres table is missing (e.g. migration not yet run), so
   *  the service silently falls back to the in-memory demo seed instead of
   *  500-ing every request. */
  private modRepo?: Repository<ModuleEntity>;
  private lesRepo?: Repository<LessonEntity>;
  private progRepo?: Repository<LessonProgressEntity>;
  private masRepo?: Repository<TopicMasteryEntity>;

  constructor(
    @Optional() private readonly comms?: CommsService,
    @Optional() private readonly events?: EventsGateway,
    @Optional() private readonly courses?: CoursesService,
    @Optional() @InjectRepository(ModuleEntity) injectedMod?: Repository<ModuleEntity>,
    @Optional() @InjectRepository(LessonEntity) injectedLes?: Repository<LessonEntity>,
    @Optional() @InjectRepository(LessonProgressEntity) injectedProg?: Repository<LessonProgressEntity>,
    @Optional() @InjectRepository(TopicMasteryEntity) injectedMas?: Repository<TopicMasteryEntity>,
  ) {
    this.modRepo = injectedMod;
    this.lesRepo = injectedLes;
    this.progRepo = injectedProg;
    this.masRepo = injectedMas;
    this.seedDemoIfEmpty();
  }

  async onModuleInit(): Promise<void> {
    await this.verifyTables();
    await this.seedDbIfEmpty();
  }

  /** Students may only access LMS for courses they are enrolled in. */
  assertStudentEnrollment(studentUsn: string, courseIdOrCode: string): void {
    if (!this.courses || !studentUsn) return;
    const internalId = this.courses.resolveCourseId(courseIdOrCode);
    if (!internalId || !this.courses.isEnrolled(internalId, studentUsn)) {
      throw new ForbiddenException('Not enrolled in this course');
    }
  }

  private async verifyTables(): Promise<void> {
    type RepoField = 'modRepo' | 'lesRepo' | 'progRepo' | 'masRepo';
    type AnyRepo = Repository<ModuleEntity | LessonEntity | LessonProgressEntity | TopicMasteryEntity>;
    const checks: Array<[RepoField, AnyRepo | undefined]> = [
      ['modRepo', this.modRepo],
      ['lesRepo', this.lesRepo],
      ['progRepo', this.progRepo],
      ['masRepo', this.masRepo],
    ];
    for (const [field, repo] of checks) {
      if (!repo) continue;
      try {
        await repo.query(`SELECT 1 FROM ${repo.metadata.tableName} LIMIT 1`);
      } catch (e) {
        this.logger.warn(
          `[LMS] table '${repo.metadata.tableName}' unreachable (${(e as Error).message}); falling back to in-memory store`,
        );
        (this as unknown as Record<RepoField, unknown>)[field] = undefined;
      }
    }
  }

  // ── Modules ──────────────────────────────────────────────────────────────

  async listModules(
    collegeId: string,
    courseId: string,
    opts: LmsListOptions = {},
  ): Promise<ModuleSummary[]> {
    const mods = this.modRepo
      ? await this.modRepo.find({ where: { collegeId, courseId }, order: { order: 'ASC' } })
      : this.memModules
          .filter(m => m.collegeId === collegeId && m.courseId === courseId)
          .sort((a, b) => a.order - b.order);
    const visible = opts.publishedOnly ? mods.filter((m) => m.published) : mods;
    const counts: Record<string, number> = {};
    const lessons = this.lesRepo
      ? await this.lesRepo.find({ where: { collegeId } })
      : this.memLessons.filter((l) => l.collegeId === collegeId);
    for (const l of lessons) {
      if (opts.publishedOnly && !l.published) continue;
      counts[l.moduleId] = (counts[l.moduleId] ?? 0) + 1;
    }
    return visible.map(m => ({
      id: m.id, collegeId: m.collegeId, courseId: m.courseId, title: m.title,
      description: m.description, order: m.order, published: m.published,
      lessonCount: counts[m.id] ?? 0,
    }));
  }

  async hasPublishedContent(collegeId: string, courseId: string): Promise<boolean> {
    const mods = await this.listModules(collegeId, courseId, { publishedOnly: true });
    return mods.some((m) => m.lessonCount > 0);
  }

  async setModulePublished(
    collegeId: string,
    moduleId: string,
    published: boolean,
  ): Promise<ModuleEntity | null> {
    if (this.modRepo) {
      const found = await this.modRepo.findOne({ where: { collegeId, id: moduleId } });
      if (!found) return null;
      found.published = published;
      found.updatedAt = new Date();
      return this.modRepo.save(found);
    }
    const idx = this.memModules.findIndex((m) => m.collegeId === collegeId && m.id === moduleId);
    if (idx < 0) return null;
    this.memModules[idx]!.published = published;
    this.memModules[idx]!.updatedAt = new Date();
    return this.memModules[idx]!;
  }

  async setLessonPublished(
    collegeId: string,
    lessonId: string,
    published: boolean,
  ): Promise<LessonEntity | null> {
    return this.updateLesson(collegeId, lessonId, { published });
  }

  async createModule(collegeId: string, input: Partial<ModuleEntity>): Promise<ModuleEntity> {
    if (!input.courseId || !input.title) throw new Error('courseId + title required');
    const mod: ModuleEntity = {
      id: `mod-${randomUUID().slice(0, 8)}`,
      collegeId,
      courseId: input.courseId,
      title: input.title,
      description: input.description,
      order: input.order ?? 0,
      published: input.published ?? false,
      createdAt: new Date(), updatedAt: new Date(),
    };
    if (this.modRepo) await this.modRepo.save(mod);
    else this.memModules.push(mod);
    return mod;
  }

  // ── Lessons ──────────────────────────────────────────────────────────────

  async listLessons(
    collegeId: string,
    moduleId: string,
    opts: LmsListOptions = {},
  ): Promise<LessonEntity[]> {
    const rows = this.lesRepo
      ? await this.lesRepo.find({ where: { collegeId, moduleId }, order: { order: 'ASC' } })
      : this.memLessons
          .filter(l => l.collegeId === collegeId && l.moduleId === moduleId)
          .sort((a, b) => a.order - b.order);
    return opts.publishedOnly ? rows.filter((l) => l.published) : rows;
  }

  async getLesson(
    collegeId: string,
    id: string,
    usn?: string,
    opts: LmsListOptions = {},
  ): Promise<LessonView | null> {
    const l = this.lesRepo
      ? await this.lesRepo.findOne({ where: { collegeId, id } })
      : this.memLessons.find(x => x.collegeId === collegeId && x.id === id) ?? null;
    if (!l || (opts.publishedOnly && !l.published)) return null;
    const progress = usn ? await this.getProgress(collegeId, usn, id) : undefined;
    return {
      id: l.id, moduleId: l.moduleId, title: l.title, order: l.order,
      contentBlocks: l.contentBlocks ?? [], checkpoint: l.checkpoint ?? [],
      topicTags: l.topicTags ?? [], published: l.published,
      progress: progress ? { state: progress.state, score: progress.score } : undefined,
    };
  }

  async createLesson(collegeId: string, input: Partial<LessonEntity>): Promise<LessonEntity> {
    if (!input.moduleId || !input.title) throw new Error('moduleId + title required');
    const lesson: LessonEntity = {
      id: `les-${randomUUID().slice(0, 8)}`,
      collegeId,
      moduleId: input.moduleId,
      title: input.title,
      order: input.order ?? 0,
      contentBlocks: input.contentBlocks ?? [],
      checkpoint: input.checkpoint ?? [],
      topicTags: input.topicTags ?? [],
      published: input.published ?? false,
      createdAt: new Date(), updatedAt: new Date(),
    };
    if (this.lesRepo) await this.lesRepo.save(lesson);
    else this.memLessons.push(lesson);
    return lesson;
  }

  async updateLesson(collegeId: string, id: string, patch: Partial<LessonEntity>): Promise<LessonEntity | null> {
    // Strip collegeId out of any incoming patch — tenancy is immutable.
    const { collegeId: _ignored, ...safePatch } = patch as LessonEntity;
    void _ignored;
    if (this.lesRepo) {
      const found = await this.lesRepo.findOne({ where: { collegeId, id } });
      if (!found) return null;
      Object.assign(found, safePatch, { updatedAt: new Date() });
      await this.lesRepo.save(found);
      return found;
    }
    const idx = this.memLessons.findIndex(l => l.collegeId === collegeId && l.id === id);
    if (idx < 0) return null;
    const existing = this.memLessons[idx]!;
    const merged: LessonEntity = { ...existing, ...safePatch, updatedAt: new Date() } as LessonEntity;
    this.memLessons[idx] = merged;
    return merged;
  }

  // ── Progress + Mastery ───────────────────────────────────────────────────

  async getProgress(collegeId: string, usn: string, lessonId: string): Promise<LessonProgressEntity | null> {
    return this.progRepo
      ? await this.progRepo.findOne({ where: { collegeId, studentUsn: usn, lessonId } })
      : this.memProgress.find(p => p.collegeId === collegeId && p.studentUsn === usn && p.lessonId === lessonId) ?? null;
  }

  async listProgressForCourse(collegeId: string, usn: string, courseId: string): Promise<LessonProgressEntity[]> {
    const lessons = await this.lessonIdsForCourse(collegeId, courseId);
    if (this.progRepo) {
      return this.progRepo
        .createQueryBuilder('p')
        .where('p.collegeId = :collegeId', { collegeId })
        .andWhere('p.studentUsn = :usn', { usn })
        .andWhere('p.lessonId IN (:...ids)', { ids: lessons.length ? lessons : [''] })
        .getMany();
    }
    return this.memProgress.filter(p =>
      p.collegeId === collegeId && p.studentUsn === usn && lessons.includes(p.lessonId)
    );
  }

  async recordCheckpoint(
    collegeId: string, usn: string, lessonId: string, score: number, totalQs: number,
  ): Promise<LessonProgressEntity> {
    const passed = totalQs > 0 && score / totalQs >= 0.66;
    const state: ProgressState = passed ? 'MASTERED' : 'IN_PROGRESS';
    let prog = await this.getProgress(collegeId, usn, lessonId);
    if (!prog) {
      prog = {
        id: `prg-${randomUUID().slice(0, 8)}`,
        collegeId, studentUsn: usn, lessonId, state, score, attempts: 1,
        updatedAt: new Date(),
      };
      if (this.progRepo) await this.progRepo.save(prog);
      else this.memProgress.push(prog);
    } else {
      prog.score = Math.max(prog.score, score);
      prog.attempts += 1;
      // Only upgrade state; never demote
      if (prog.state !== 'MASTERED') prog.state = state;
      prog.updatedAt = new Date();
      if (this.progRepo) await this.progRepo.save(prog);
    }
    const courseId = await this.courseIdForLesson(collegeId, lessonId);
    if (state === 'MASTERED') {
      await this.bumpTopicMastery(collegeId, usn, lessonId);
      this.events?.emitLmsLessonMastered({ lessonId, courseId, institutionId: collegeId });
      this.logger.log(`[LMS] lesson mastered lessonId=${lessonId} courseId=${courseId}`);
    } else if (!passed) {
      this.events?.emitLmsCheckpointFailed({ lessonId, courseId, institutionId: collegeId });
      this.logger.log(`[LMS] checkpoint failed lessonId=${lessonId} courseId=${courseId}`);
    }
    return prog;
  }

  /** Sarvam TTS narration for lesson markdown (Phase 1). */
  async narrateLesson(
    collegeId: string,
    lessonId: string,
    lang: string,
  ): Promise<{ audioUrl: string | null; lang: string; fallbackText?: string; useBrowserTts?: boolean }> {
    const lesson = await this.getLesson(collegeId, lessonId, undefined, { publishedOnly: false });
    if (!lesson) return { audioUrl: null, lang };
    const body = (lesson.contentBlocks.find((b) => b.kind === 'MARKDOWN')?.data ?? '').slice(0, 2000);
    if (!body) return { audioUrl: null, lang, fallbackText: '', useBrowserTts: true };

    const cacheKey = `lms-narr:${lessonId}:${lang}`;
    const baseUrl =
      process.env['TWILIO_WEBHOOK_BASE_URL'] ??
      process.env['APP_URL'] ??
      'http://localhost:3001';

    const comms = this.comms;
    if (comms?.getAudio(cacheKey)) {
      return {
        audioUrl: comms.signAudioUrl(cacheKey, baseUrl.replace(/\/$/, '')),
        lang,
      };
    }

    const langCode = SARVAM_LANG[lang] ?? 'en-IN';
    const audio = await comms?.generateSarvamAudioPublic(body, langCode);
    if (audio?.length && comms) {
      comms.setAudioPublic(cacheKey, audio);
      return {
        audioUrl: comms.signAudioUrl(cacheKey, baseUrl.replace(/\/$/, '')),
        lang,
      };
    }

    return { audioUrl: null, lang, fallbackText: body, useBrowserTts: true };
  }

  private async bumpTopicMastery(collegeId: string, usn: string, lessonId: string): Promise<void> {
    const lesson = this.lesRepo
      ? await this.lesRepo.findOne({ where: { collegeId, id: lessonId } })
      : this.memLessons.find(l => l.collegeId === collegeId && l.id === lessonId);
    if (!lesson) return;
    const courseId = await this.courseIdForLesson(collegeId, lessonId);
    for (const topic of lesson.topicTags ?? []) {
      const existing = this.masRepo
        ? await this.masRepo.findOne({ where: { collegeId, studentUsn: usn, topic } })
        : this.memMastery.find(m => m.collegeId === collegeId && m.studentUsn === usn && m.topic === topic);
      if (existing) {
        existing.masteryScore = Math.min(1, existing.masteryScore + 0.34);
        existing.updatedAt = new Date();
        if (this.masRepo) await this.masRepo.save(existing);
      } else {
        const row: TopicMasteryEntity = {
          id: `tm-${randomUUID().slice(0, 8)}`,
          collegeId, studentUsn: usn, courseId, topic, masteryScore: 0.34,
          updatedAt: new Date(),
        };
        if (this.masRepo) await this.masRepo.save(row);
        else this.memMastery.push(row);
      }
    }
  }

  async getMastery(collegeId: string, usn: string, courseId: string): Promise<TopicMasteryEntity[]> {
    return this.masRepo
      ? await this.masRepo.find({ where: { collegeId, studentUsn: usn, courseId } })
      : this.memMastery.filter(m => m.collegeId === collegeId && m.studentUsn === usn && m.courseId === courseId);
  }

  // ── AI features ──────────────────────────────────────────────────────────

  /** ELI5 rewrite at three levels: 'beginner' | 'intermediate' | 'advanced'.
   *  Cached per (collegeId, lessonId, level) so two tenants never share text. */
  async rewriteAtLevel(
    collegeId: string, lessonId: string, level: 'beginner' | 'intermediate' | 'advanced',
  ): Promise<string> {
    const key = `eli:${collegeId}:${lessonId}:${level}`;
    const cached = this.textCache.get(key);
    if (cached) return cached;
    const lesson = await this.getLesson(collegeId, lessonId);
    if (!lesson) return '';
    const body = (lesson.contentBlocks.find(b => b.kind === 'MARKDOWN')?.data ?? '').slice(0, 2000);
    if (!body) return '';
    const audience = level === 'beginner' ? 'a 12-year-old with no prior CS background' :
      level === 'advanced' ? 'a senior engineer who wants a precise technical refresher' :
      'an undergraduate CS student';
    const prompt =
      `Rewrite the following lesson for ${audience}. Use plain language, short sentences, and one concrete example. Output Markdown.\n\n---\n${body}`;
    try {
      const out = await geminiGenerate(prompt, GEMINI_FAST, 600);
      this.textCache.set(key, out);
      return out;
    } catch (e) {
      this.logger.warn(`ELI5 failed: ${(e as Error).message}`);
      return body;
    }
  }

  /** Faculty co-pilot: paste syllabus → AI drafts a module skeleton.
   *  collegeId is used to namespace the cache and may eventually inject
   *  per-tenant prompt overrides (e.g. autonomous-college grading rubric). */
  async draftModuleFromSyllabus(collegeId: string, courseId: string, syllabus: string): Promise<{
    title: string; lessons: Array<{ title: string; topicTags: string[]; checkpoint: CheckpointQuestion[]; markdown: string }>;
  }> {
    void collegeId;
    const prompt =
      `You are designing one LMS module for VTU course ${courseId}.\n` +
      `Input syllabus chunk:\n${syllabus.slice(0, 3000)}\n\n` +
      `Output STRICT JSON ONLY, no prose, schema:\n` +
      `{\n  "title": "<module title>",\n  "lessons": [\n    {\n      "title": "<lesson title>",\n      "topicTags": ["<topic1>", "<topic2>"],\n      "markdown": "<350-500 word Markdown lesson body, with one ## subsection per concept>",\n      "checkpoint": [\n        { "q": "...", "options": ["A","B","C","D"], "correctIndex": 0 },\n        ...3 questions\n      ]\n    }\n  ]\n}\n` +
      `Generate exactly 5 lessons. Each checkpoint has exactly 3 questions.`;
    try {
      const raw = await geminiGenerate(prompt, GEMINI_SMART, 4000);
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return JSON.parse(cleaned) as ReturnType<LmsService['draftModuleFromSyllabus']> extends Promise<infer R> ? R : never;
    } catch (e) {
      this.logger.warn(`Co-pilot draft failed, returning skeleton: ${(e as Error).message}`);
      return {
        title: `Module — ${courseId}`,
        lessons: Array.from({ length: 5 }, (_, i) => ({
          title: `Lesson ${i + 1}`,
          topicTags: [`topic-${i + 1}`],
          markdown: `## Lesson ${i + 1}\n\nDraft pending — please edit.`,
          checkpoint: [
            { q: 'Sample Q1', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
            { q: 'Sample Q2', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
            { q: 'Sample Q3', options: ['A', 'B', 'C', 'D'], correctIndex: 2 },
          ],
        })),
      };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async lessonIdsForCourse(collegeId: string, courseId: string): Promise<string[]> {
    const mods = await this.listModules(collegeId, courseId);
    const out: string[] = [];
    for (const m of mods) {
      const ls = await this.listLessons(collegeId, m.id);
      out.push(...ls.map(l => l.id));
    }
    return out;
  }

  async getLessonCourseId(collegeId: string, lessonId: string): Promise<string> {
    return this.courseIdForLesson(collegeId, lessonId);
  }

  private async courseIdForLesson(collegeId: string, lessonId: string): Promise<string> {
    const lesson = this.lesRepo
      ? await this.lesRepo.findOne({ where: { collegeId, id: lessonId } })
      : this.memLessons.find(l => l.collegeId === collegeId && l.id === lessonId);
    if (!lesson) return '';
    const mod = this.modRepo
      ? await this.modRepo.findOne({ where: { collegeId, id: lesson.moduleId } })
      : this.memModules.find(m => m.collegeId === collegeId && m.id === lesson.moduleId);
    return mod?.courseId ?? '';
  }

  private async seedDbIfEmpty(): Promise<void> {
    if (!this.modRepo || !this.lesRepo) return;
    const collegeId = process.env['DEFAULT_COLLEGE_ID'] ?? 'rvce';
    const count = await this.modRepo.count({ where: { collegeId, courseId: LMS_DEMO_COURSE_ID } });
    if (count > 0) return;
    const mod: ModuleEntity = {
      id: LMS_DEMO_MODULE_ID,
      collegeId,
      courseId: LMS_DEMO_COURSE_ID,
      title: LMS_DEMO_MODULE.title,
      description: LMS_DEMO_MODULE.description,
      order: LMS_DEMO_MODULE.order,
      published: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.modRepo.save(mod);
    for (const l of LMS_DEMO_LESSONS) {
      await this.lesRepo.save({
        id: l.id,
        collegeId,
        moduleId: mod.id,
        title: l.title,
        order: l.order,
        contentBlocks: l.contentBlocks,
        checkpoint: l.checkpoint,
        topicTags: l.topicTags,
        published: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    this.logger.log(`[LMS] DB seed: ${LMS_DEMO_LESSONS.length} lessons for ${LMS_DEMO_COURSE_ID}`);
  }

  /** In-memory demo when Postgres tables/repos are unavailable. */
  private seedDemoIfEmpty(): void {
    if (this.memModules.length > 0) return;
    const collegeId = process.env['DEFAULT_COLLEGE_ID'] ?? 'default';
    const mod: ModuleEntity = {
      id: LMS_DEMO_MODULE_ID,
      collegeId,
      courseId: LMS_DEMO_COURSE_ID,
      title: LMS_DEMO_MODULE.title,
      description: LMS_DEMO_MODULE.description,
      order: LMS_DEMO_MODULE.order,
      published: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.memModules.push(mod);
    for (const l of LMS_DEMO_LESSONS) {
      this.memLessons.push({
        id: l.id,
        collegeId,
        moduleId: mod.id,
        title: l.title,
        order: l.order,
        contentBlocks: l.contentBlocks,
        checkpoint: l.checkpoint,
        topicTags: l.topicTags,
        published: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    this.logger.log(`Seeded demo LMS content: ${this.memLessons.length} lessons in ${LMS_DEMO_COURSE_ID}`);
  }
}
