import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  LessonEntity, ModuleEntity, LessonProgressEntity, TopicMasteryEntity,
  type LessonContentBlock, type CheckpointQuestion, type ProgressState,
} from '../entities/lms.entity';
import { geminiGenerate, GEMINI_FAST, GEMINI_SMART } from '../shared/gemini-ai';

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
@Injectable()
export class LmsService {
  private readonly logger = new Logger(LmsService.name);

  // In-memory fallbacks (used when repos not provided in non-DB envs)
  private readonly memModules: ModuleEntity[] = [];
  private readonly memLessons: LessonEntity[] = [];
  private readonly memProgress: LessonProgressEntity[] = [];
  private readonly memMastery: TopicMasteryEntity[] = [];
  // Cache for ELI5 + narration text rewrites: key = `${lessonId}:${level}` or `${lessonId}:${lang}`
  private readonly textCache = new Map<string, string>();

  constructor(
    @Optional() @InjectRepository(ModuleEntity) private readonly modRepo?: Repository<ModuleEntity>,
    @Optional() @InjectRepository(LessonEntity) private readonly lesRepo?: Repository<LessonEntity>,
    @Optional() @InjectRepository(LessonProgressEntity) private readonly progRepo?: Repository<LessonProgressEntity>,
    @Optional() @InjectRepository(TopicMasteryEntity) private readonly masRepo?: Repository<TopicMasteryEntity>,
  ) {
    this.seedDemoIfEmpty();
  }

  // ── Modules ──────────────────────────────────────────────────────────────

  async listModules(collegeId: string, courseId: string): Promise<ModuleSummary[]> {
    const mods = this.modRepo
      ? await this.modRepo.find({ where: { collegeId, courseId }, order: { order: 'ASC' } })
      : this.memModules
          .filter(m => m.collegeId === collegeId && m.courseId === courseId)
          .sort((a, b) => a.order - b.order);
    const counts: Record<string, number> = {};
    if (this.lesRepo) {
      const all = await this.lesRepo.find({ where: { collegeId } });
      for (const l of all) counts[l.moduleId] = (counts[l.moduleId] ?? 0) + 1;
    } else {
      for (const l of this.memLessons.filter(l => l.collegeId === collegeId)) {
        counts[l.moduleId] = (counts[l.moduleId] ?? 0) + 1;
      }
    }
    return mods.map(m => ({
      id: m.id, collegeId: m.collegeId, courseId: m.courseId, title: m.title,
      description: m.description, order: m.order, published: m.published,
      lessonCount: counts[m.id] ?? 0,
    }));
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

  async listLessons(collegeId: string, moduleId: string): Promise<LessonEntity[]> {
    return this.lesRepo
      ? await this.lesRepo.find({ where: { collegeId, moduleId }, order: { order: 'ASC' } })
      : this.memLessons
          .filter(l => l.collegeId === collegeId && l.moduleId === moduleId)
          .sort((a, b) => a.order - b.order);
  }

  async getLesson(collegeId: string, id: string, usn?: string): Promise<LessonView | null> {
    const l = this.lesRepo
      ? await this.lesRepo.findOne({ where: { collegeId, id } })
      : this.memLessons.find(x => x.collegeId === collegeId && x.id === id) ?? null;
    if (!l) return null;
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
    if (state === 'MASTERED') await this.bumpTopicMastery(collegeId, usn, lessonId);
    return prog;
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

  /** Seed one demo course (CS501 Operating Systems) so the demo flow has content
   *  even when DB is empty and no faculty has authored a module yet. */
  private seedDemoIfEmpty(): void {
    if (this.memModules.length > 0) return;
    const collegeId = process.env['DEFAULT_COLLEGE_ID'] ?? 'default';
    const courseId = 'CS501';
    const mod: ModuleEntity = {
      id: 'mod-os-scheduling',
      collegeId,
      courseId,
      title: 'Process Scheduling',
      description: 'How the OS decides which process runs next on the CPU.',
      order: 1,
      published: true,
      createdAt: new Date(), updatedAt: new Date(),
    };
    this.memModules.push(mod);
    const sampleCode = `# FCFS scheduling example
processes = [("P1", 5), ("P2", 3), ("P3", 8)]
time = 0
for name, burst in processes:
    print(f"{name} runs from {time} to {time + burst}")
    time += burst
print(f"Average completion time: {time / len(processes):.1f}")`;
    const lessons: Array<Partial<LessonEntity>> = [
      {
        id: 'les-fcfs', collegeId, moduleId: mod.id, title: 'First-Come First-Served (FCFS)', order: 1, published: true,
        topicTags: ['scheduling', 'fcfs'],
        contentBlocks: [
          { kind: 'MARKDOWN', data: '## FCFS Scheduling\n\nFirst-Come First-Served is the simplest CPU scheduling algorithm. Processes are executed strictly in the order they arrive in the ready queue.\n\n**Pros:** simple, fair in arrival order.\n\n**Cons:** *convoy effect* — one long process delays many short ones.\n\n### Example\nIf P1 (burst 24ms), P2 (3ms), P3 (3ms) arrive in that order, P2 and P3 wait 24ms each despite needing only 3ms.' },
          { kind: 'CODE', data: sampleCode },
        ],
        checkpoint: [
          { q: 'FCFS is best described as:', options: ['Preemptive', 'Non-preemptive', 'Round-robin', 'Priority-based'], correctIndex: 1 },
          { q: 'The "convoy effect" means:', options: ['CPU is idle', 'Short jobs wait behind long jobs', 'Disk is slow', 'I/O bound jobs starve'], correctIndex: 1 },
          { q: 'FCFS scheduling order is determined by:', options: ['Burst time', 'Priority', 'Arrival time', 'Random'], correctIndex: 2 },
        ],
      },
      {
        id: 'les-sjf', collegeId, moduleId: mod.id, title: 'Shortest Job First (SJF)', order: 2, published: true,
        topicTags: ['scheduling', 'sjf'],
        contentBlocks: [
          { kind: 'MARKDOWN', data: '## Shortest Job First\n\nSJF picks the process with the smallest next CPU burst. Optimal for minimum average waiting time, but predicting the next burst is hard in practice.' },
          { kind: 'VIDEO', data: 'https://www.youtube.com/watch?v=2h3eWaPx8SA' },
        ],
        checkpoint: [
          { q: 'SJF minimises:', options: ['Throughput', 'Avg waiting time', 'CPU util', 'Response time'], correctIndex: 1 },
          { q: 'SJF requires:', options: ['Random selection', 'Knowing burst times in advance', 'Two CPUs', 'Priority list'], correctIndex: 1 },
          { q: 'SJF can be:', options: ['Only preemptive', 'Only non-preemptive', 'Either', 'Neither'], correctIndex: 2 },
        ],
      },
      {
        id: 'les-rr', collegeId, moduleId: mod.id, title: 'Round Robin (RR)', order: 3, published: true,
        topicTags: ['scheduling', 'round-robin', 'time-slice'],
        contentBlocks: [
          { kind: 'MARKDOWN', data: '## Round Robin\n\nEach process gets a fixed *time quantum* (e.g. 10ms) then is preempted. Good for interactive systems. Choosing the quantum is the key tuning knob.' },
        ],
        checkpoint: [
          { q: 'Round Robin is:', options: ['Non-preemptive', 'Preemptive', 'Cooperative', 'Manual'], correctIndex: 1 },
          { q: 'A very small time quantum causes:', options: ['Better latency, lower throughput', 'Better throughput', 'CPU starvation', 'Disk thrashing'], correctIndex: 0 },
          { q: 'RR is best for:', options: ['Batch jobs', 'Interactive workloads', 'Real-time only', 'Memory-bound'], correctIndex: 1 },
        ],
      },
    ];
    for (const l of lessons) {
      this.memLessons.push({
        ...(l as LessonEntity),
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
    this.logger.log(`Seeded demo LMS content: ${this.memLessons.length} lessons in ${courseId}`);
  }
}
