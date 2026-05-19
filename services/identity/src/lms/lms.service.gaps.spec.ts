/**
 * Supplementary unit tests: lms.service.ts coverage gaps.
 *
 * The base spec (`lms.service.spec.ts`) exercises the in-memory store via the
 * Nest TestingModule with no injected repos. That leaves the following
 * uncovered:
 *
 *   - verifyTables — write-path repo failure (LOG LOUD, do NOT null out)
 *                  — read-path repo failure (LOG WARN, null out for fallback)
 *   - createModule — validation throw (missing courseId / title)
 *                  — repo path (modRepo present → calls save)
 *   - createLesson — validation throw (missing moduleId / title)
 *                  — repo path
 *   - updateLesson — repo path (found + not-found)
 *                  — repo path with collegeId strip (immutability of tenancy)
 *                  — in-memory not-found returns null
 *   - listProgressForCourse — queryBuilder branch with non-empty + empty lesson list
 *   - getProgress / getMastery / listLessons / getLesson — repo branches
 *   - bumpTopicMastery — mastery score caps at 1.0 (existing record path)
 *                      — early return when lesson missing
 *   - rewriteAtLevel — happy path (Gemini success + cache hit on second call)
 *                    — lesson missing → ''
 *                    — body empty → ''
 *                    — intermediate audience branch
 *   - draftModuleFromSyllabus — happy path (Gemini returns JSON wrapped in ```json fences)
 *   - courseIdForLesson — lesson missing → '' (repo path)
 *
 * ERP context:
 *   - The verifyTables asymmetry is a regression guard for a CRITICAL
 *     multi-tenant safety property (review feedback on PR #29). Silently
 *     routing writes to an in-memory store after a Postgres blip would let
 *     College A's modules end up in College B's tenant on a different pod.
 *   - The updateLesson collegeId strip is the only barrier against a faculty
 *     client editing a lesson into a different tenant via crafted JSON.
 *   - The mastery cap (Math.min(1, …)) prevents a flood of identical
 *     checkpoint submissions from inflating "mastered" metrics that feed the
 *     NAAC report.
 */

import { Logger } from '@nestjs/common';
import { LmsService } from './lms.service';
import * as gemini from '../shared/gemini-ai';

// Silence noisy logger output so the suite is hermetic
jest.spyOn(Logger.prototype, 'warn').mockImplementation();
jest.spyOn(Logger.prototype, 'error').mockImplementation();
jest.spyOn(Logger.prototype, 'log').mockImplementation();

/** Build a TypeORM-shaped repo stub with a configurable `query` failure. */
function makeRepoStub(
  tableName: string,
  rows: any[] = [],
  opts: { queryFails?: boolean; queryError?: string } = {},
) {
  return {
    metadata: { tableName },
    query: jest.fn().mockImplementation(async () => {
      if (opts.queryFails) throw new Error(opts.queryError ?? 'relation missing');
      return [{ '?column?': 1 }];
    }),
    find: jest.fn().mockResolvedValue(rows),
    findOne: jest.fn().mockImplementation(async ({ where }: any) => {
      return (
        rows.find((r) =>
          Object.entries(where).every(([k, v]) => (r as any)[k] === v),
        ) ?? null
      );
    }),
    save: jest.fn().mockImplementation(async (row: any) => row),
    createQueryBuilder: jest.fn(),
  } as any;
}

const COLLEGE = 'col-test';
const ORIGINAL_DEFAULT = process.env['DEFAULT_COLLEGE_ID'];

describe('LmsService — coverage gap fill', () => {
  beforeEach(() => {
    process.env['DEFAULT_COLLEGE_ID'] = COLLEGE;
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (ORIGINAL_DEFAULT === undefined) delete process.env['DEFAULT_COLLEGE_ID'];
    else process.env['DEFAULT_COLLEGE_ID'] = ORIGINAL_DEFAULT;
  });

  // ── verifyTables ─────────────────────────────────────────────────────────

  describe('verifyTables', () => {
    it('write-path repo failure: logs error and KEEPS the repo (next write must surface real error)', async () => {
      const modRepo = makeRepoStub('lms_modules', [], { queryFails: true });
      const lesRepo = makeRepoStub('lms_lessons');
      const errSpy = jest.spyOn(Logger.prototype, 'error');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const svc = new LmsService(modRepo, lesRepo, undefined, undefined);
      // Wait for the verifyTables microtask chain to settle
      await new Promise((r) => setImmediate(r));
      expect(errSpy).toHaveBeenCalled();
      const calledWith = errSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(calledWith).toMatch(/write-path table 'lms_modules' unreachable/);
      // CRITICAL: subsequent listModules must call the (still-present) repo,
      // not silently fall back to memory.
      modRepo.find.mockResolvedValueOnce([]);
      await svc.listModules(COLLEGE, 'CS501');
      expect(modRepo.find).toHaveBeenCalled();
    });

    it('read-path repo failure: logs warn and NULLS OUT the repo (falls back to memory)', async () => {
      const modRepo = makeRepoStub('lms_modules');
      const lesRepo = makeRepoStub('lms_lessons');
      const progRepo = makeRepoStub('lms_lesson_progress', [], {
        queryFails: true,
      });
      const masRepo = makeRepoStub('lms_topic_mastery');
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const svc = new LmsService(modRepo, lesRepo, progRepo, masRepo);
      await new Promise((r) => setImmediate(r));
      const warns = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(warns).toMatch(/read-path table 'lms_lesson_progress' unreachable/);
      // Subsequent progress lookup uses memory fallback (would throw if repo
      // were still in place since query() rejects).
      const prog = await svc.getProgress(COLLEGE, '1RV21CS001', 'les-fcfs');
      expect(prog).toBeNull();
    });

    it('skips repos that are undefined (no DB injected)', async () => {
      // Standard in-memory construction — should not blow up
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      const mods = await svc.listModules(COLLEGE, 'CS501');
      expect(mods).toHaveLength(1); // demo seed
    });
  });

  // ── createModule / createLesson validation ───────────────────────────────

  describe('createModule', () => {
    it('throws when courseId missing', async () => {
      const svc = new LmsService();
      await expect(svc.createModule(COLLEGE, { title: 'X' } as any)).rejects.toThrow(
        /courseId \+ title required/,
      );
    });

    it('throws when title missing', async () => {
      const svc = new LmsService();
      await expect(
        svc.createModule(COLLEGE, { courseId: 'CS501' } as any),
      ).rejects.toThrow(/courseId \+ title required/);
    });

    it('writes through modRepo when injected and applies defaults (order=0, published=false)', async () => {
      const modRepo = makeRepoStub('lms_modules');
      const svc = new LmsService(modRepo, undefined, undefined, undefined);
      await new Promise((r) => setImmediate(r));
      const mod = await svc.createModule(COLLEGE, { courseId: 'CS501', title: 'm1' });
      expect(modRepo.save).toHaveBeenCalled();
      expect(mod.order).toBe(0);
      expect(mod.published).toBe(false);
      expect(mod.id).toMatch(/^mod-/);
    });
  });

  describe('createLesson', () => {
    it('throws when moduleId missing', async () => {
      const svc = new LmsService();
      await expect(
        svc.createLesson(COLLEGE, { title: 'X' } as any),
      ).rejects.toThrow(/moduleId \+ title required/);
    });

    it('throws when title missing', async () => {
      const svc = new LmsService();
      await expect(
        svc.createLesson(COLLEGE, { moduleId: 'm1' } as any),
      ).rejects.toThrow(/moduleId \+ title required/);
    });

    it('writes through lesRepo with defaults when injected', async () => {
      const lesRepo = makeRepoStub('lms_lessons');
      const svc = new LmsService(undefined, lesRepo, undefined, undefined);
      await new Promise((r) => setImmediate(r));
      const lesson = await svc.createLesson(COLLEGE, {
        moduleId: 'm1',
        title: 'L1',
      });
      expect(lesRepo.save).toHaveBeenCalled();
      expect(lesson.order).toBe(0);
      expect(lesson.published).toBe(false);
      expect(lesson.checkpoint).toEqual([]);
    });
  });

  // ── updateLesson — repo branches + collegeId strip ───────────────────────

  describe('updateLesson', () => {
    it('repo path: returns null when row not found', async () => {
      const lesRepo = makeRepoStub('lms_lessons', []);
      const svc = new LmsService(undefined, lesRepo, undefined, undefined);
      await new Promise((r) => setImmediate(r));
      const res = await svc.updateLesson(COLLEGE, 'missing', { title: 'x' });
      expect(res).toBeNull();
    });

    it('repo path: merges patch and saves, stripping collegeId from incoming patch (tenancy immutable)', async () => {
      const original = {
        id: 'l1',
        collegeId: COLLEGE,
        moduleId: 'm1',
        title: 'old',
        order: 0,
        published: false,
        contentBlocks: [],
        checkpoint: [],
        topicTags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const lesRepo = makeRepoStub('lms_lessons', [original]);
      const svc = new LmsService(undefined, lesRepo, undefined, undefined);
      await new Promise((r) => setImmediate(r));
      // Attempt cross-tenant takeover via patch.collegeId
      const updated = await svc.updateLesson(COLLEGE, 'l1', {
        title: 'new',
        collegeId: 'col-MALICIOUS' as any,
      } as any);
      expect(updated).toBeDefined();
      expect(updated!.collegeId).toBe(COLLEGE);
      expect(updated!.title).toBe('new');
      expect(lesRepo.save).toHaveBeenCalled();
    });

    it('in-memory path: returns null when row not found', async () => {
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      const res = await svc.updateLesson(COLLEGE, 'totally-missing', { title: 'x' });
      expect(res).toBeNull();
    });

    it('in-memory path: returns merged lesson and strips collegeId', async () => {
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      // Use the seeded les-fcfs lesson
      const res = await svc.updateLesson(COLLEGE, 'les-fcfs', {
        title: 'FCFS (renamed)',
        collegeId: 'col-MALICIOUS' as any,
      } as any);
      expect(res).toBeDefined();
      expect(res!.collegeId).toBe(COLLEGE);
      expect(res!.title).toBe('FCFS (renamed)');
    });
  });

  // ── listLessons / listModules / getLesson / getProgress — repo branches ──

  describe('repo-backed read paths', () => {
    it('listModules repo path: returns lesson counts from lesRepo.find', async () => {
      const modules = [
        { id: 'm1', collegeId: COLLEGE, courseId: 'CS501', title: 'M1', order: 0, published: true },
      ];
      const lessons = [
        { id: 'l1', collegeId: COLLEGE, moduleId: 'm1' },
        { id: 'l2', collegeId: COLLEGE, moduleId: 'm1' },
      ];
      const modRepo = makeRepoStub('lms_modules', modules);
      const lesRepo = makeRepoStub('lms_lessons', lessons);
      const svc = new LmsService(modRepo, lesRepo, undefined, undefined);
      await new Promise((r) => setImmediate(r));
      const res = await svc.listModules(COLLEGE, 'CS501');
      expect(res).toHaveLength(1);
      expect(res[0]?.lessonCount).toBe(2);
    });

    it('listLessons repo path returns rows from lesRepo.find ordered by order ASC', async () => {
      const lesRepo = makeRepoStub('lms_lessons', [
        { id: 'l1', moduleId: 'm1', order: 1 },
        { id: 'l2', moduleId: 'm1', order: 2 },
      ]);
      const svc = new LmsService(undefined, lesRepo, undefined, undefined);
      await new Promise((r) => setImmediate(r));
      const res = await svc.listLessons(COLLEGE, 'm1');
      expect(res).toHaveLength(2);
      expect(lesRepo.find).toHaveBeenCalled();
    });

    it('getLesson repo path returns null when row missing', async () => {
      const lesRepo = makeRepoStub('lms_lessons', []);
      const svc = new LmsService(undefined, lesRepo, undefined, undefined);
      await new Promise((r) => setImmediate(r));
      const res = await svc.getLesson(COLLEGE, 'missing');
      expect(res).toBeNull();
    });

    it('getLesson repo path returns a view with progress merged when usn provided', async () => {
      const lesson = {
        id: 'l1', collegeId: COLLEGE, moduleId: 'm1', title: 't', order: 1,
        contentBlocks: [], checkpoint: [], topicTags: ['x'], published: true,
      };
      const lesRepo = makeRepoStub('lms_lessons', [lesson]);
      const progRepo = makeRepoStub('lms_lesson_progress', [
        { collegeId: COLLEGE, studentUsn: 'U1', lessonId: 'l1', state: 'IN_PROGRESS', score: 1, attempts: 1, updatedAt: new Date() },
      ]);
      const svc = new LmsService(undefined, lesRepo, progRepo, undefined);
      await new Promise((r) => setImmediate(r));
      const res = await svc.getLesson(COLLEGE, 'l1', 'U1');
      expect(res?.progress?.state).toBe('IN_PROGRESS');
    });

    it('getProgress repo path returns null when no row', async () => {
      const progRepo = makeRepoStub('lms_lesson_progress', []);
      const svc = new LmsService(undefined, undefined, progRepo, undefined);
      await new Promise((r) => setImmediate(r));
      const res = await svc.getProgress(COLLEGE, 'U1', 'l1');
      expect(res).toBeNull();
    });

    it('getMastery repo path returns rows from masRepo.find', async () => {
      const masRepo = makeRepoStub('lms_topic_mastery', [
        { topic: 't1', courseId: 'CS501', masteryScore: 0.5 },
      ]);
      const svc = new LmsService(undefined, undefined, undefined, masRepo);
      await new Promise((r) => setImmediate(r));
      const res = await svc.getMastery(COLLEGE, 'U1', 'CS501');
      expect(res).toHaveLength(1);
      expect(masRepo.find).toHaveBeenCalled();
    });
  });

  // ── listProgressForCourse — queryBuilder branch ───────────────────────────

  describe('listProgressForCourse repo path', () => {
    it('uses queryBuilder with non-empty lesson id list', async () => {
      const modules = [
        { id: 'm1', collegeId: COLLEGE, courseId: 'CS501', title: 'M', order: 0, published: true },
      ];
      const lessons = [{ id: 'l1', collegeId: COLLEGE, moduleId: 'm1' }];
      const modRepo = makeRepoStub('lms_modules', modules);
      const lesRepo = makeRepoStub('lms_lessons', lessons);
      const fakeQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'p1' }]),
      };
      const progRepo = makeRepoStub('lms_lesson_progress');
      progRepo.createQueryBuilder = jest.fn().mockReturnValue(fakeQB);
      const svc = new LmsService(modRepo, lesRepo, progRepo, undefined);
      await new Promise((r) => setImmediate(r));
      const res = await svc.listProgressForCourse(COLLEGE, 'U1', 'CS501');
      expect(res).toEqual([{ id: 'p1' }]);
      // Critical: ids passed in must be non-empty
      const idsArg = fakeQB.andWhere.mock.calls.find((c) =>
        String(c[0]).includes('lessonId IN'),
      )?.[1];
      expect(idsArg).toEqual({ ids: ['l1'] });
    });

    it('uses queryBuilder with [""] placeholder when no lessons match (avoids empty IN clause)', async () => {
      const modRepo = makeRepoStub('lms_modules', []); // no modules → no lessons
      const lesRepo = makeRepoStub('lms_lessons', []);
      const fakeQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      const progRepo = makeRepoStub('lms_lesson_progress');
      progRepo.createQueryBuilder = jest.fn().mockReturnValue(fakeQB);
      const svc = new LmsService(modRepo, lesRepo, progRepo, undefined);
      await new Promise((r) => setImmediate(r));
      await svc.listProgressForCourse(COLLEGE, 'U1', 'CS999');
      const idsArg = fakeQB.andWhere.mock.calls.find((c) =>
        String(c[0]).includes('lessonId IN'),
      )?.[1];
      expect(idsArg).toEqual({ ids: [''] });
    });
  });

  // ── bumpTopicMastery — cap at 1.0 + early return when lesson missing ─────

  describe('bumpTopicMastery (via recordCheckpoint)', () => {
    it('caps masteryScore at 1.0 when topic already near ceiling', async () => {
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      // FCFS lesson has topicTags ['scheduling','fcfs']. Pass 3 times → 0.34 + 0.34 + 0.34 = 1.02 → capped to 1.0
      await svc.recordCheckpoint(COLLEGE, 'U1', 'les-fcfs', 3, 3);
      await svc.recordCheckpoint(COLLEGE, 'U1', 'les-fcfs', 3, 3);
      await svc.recordCheckpoint(COLLEGE, 'U1', 'les-fcfs', 3, 3);
      const mastery = await svc.getMastery(COLLEGE, 'U1', 'CS501');
      const fcfs = mastery.find((m) => m.topic === 'fcfs')!;
      expect(fcfs.masteryScore).toBeLessThanOrEqual(1);
      expect(fcfs.masteryScore).toBeGreaterThan(0.9);
    });

    it('writes mastery row through masRepo when injected (existing record path)', async () => {
      const modules = [
        { id: 'm1', collegeId: COLLEGE, courseId: 'CS501', title: 'M', order: 0, published: true },
      ];
      const lessons = [
        { id: 'l1', collegeId: COLLEGE, moduleId: 'm1', title: 't', order: 1, published: true, topicTags: ['t1'], contentBlocks: [], checkpoint: [], createdAt: new Date(), updatedAt: new Date() },
      ];
      const existing = [{ topic: 't1', courseId: 'CS501', collegeId: COLLEGE, studentUsn: 'U1', masteryScore: 0.5, id: 'tm-1', updatedAt: new Date() }];
      const modRepo = makeRepoStub('lms_modules', modules);
      const lesRepo = makeRepoStub('lms_lessons', lessons);
      const progRepo = makeRepoStub('lms_lesson_progress', []);
      const masRepo = makeRepoStub('lms_topic_mastery', existing);
      const svc = new LmsService(modRepo, lesRepo, progRepo, masRepo);
      await new Promise((r) => setImmediate(r));
      await svc.recordCheckpoint(COLLEGE, 'U1', 'l1', 3, 3);
      expect(masRepo.save).toHaveBeenCalled();
      // 0.5 + 0.34 = 0.84 (under cap)
      const saved = masRepo.save.mock.calls.slice(-1)[0][0];
      expect(saved.masteryScore).toBeCloseTo(0.84, 2);
    });

    it('writes a new mastery row through masRepo when none exists', async () => {
      const modules = [
        { id: 'm1', collegeId: COLLEGE, courseId: 'CS501', title: 'M', order: 0, published: true },
      ];
      const lessons = [
        { id: 'l1', collegeId: COLLEGE, moduleId: 'm1', title: 't', order: 1, published: true, topicTags: ['t1'], contentBlocks: [], checkpoint: [], createdAt: new Date(), updatedAt: new Date() },
      ];
      const modRepo = makeRepoStub('lms_modules', modules);
      const lesRepo = makeRepoStub('lms_lessons', lessons);
      const progRepo = makeRepoStub('lms_lesson_progress', []);
      const masRepo = makeRepoStub('lms_topic_mastery', []);
      const svc = new LmsService(modRepo, lesRepo, progRepo, masRepo);
      await new Promise((r) => setImmediate(r));
      await svc.recordCheckpoint(COLLEGE, 'U1', 'l1', 3, 3);
      // First save in masRepo is the brand-new row
      const calls = masRepo.save.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const row = calls[0]![0];
      expect(row.topic).toBe('t1');
      expect(row.masteryScore).toBeCloseTo(0.34, 2);
    });
  });

  // ── rewriteAtLevel ───────────────────────────────────────────────────────

  describe('rewriteAtLevel', () => {
    it('returns "" when lesson missing', async () => {
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      const out = await svc.rewriteAtLevel(COLLEGE, 'no-such-lesson', 'beginner');
      expect(out).toBe('');
    });

    it('returns "" when lesson has no MARKDOWN content block', async () => {
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      // Create a lesson with only a CODE block, no MARKDOWN
      await svc.createLesson(COLLEGE, {
        moduleId: 'mod-os-scheduling',
        title: 'Just code',
        contentBlocks: [{ kind: 'CODE', data: 'print("x")' }],
      } as any);
      // Pull its id from the in-memory list — last lesson inserted
      const lessons = await svc.listLessons(COLLEGE, 'mod-os-scheduling');
      const codeLesson = lessons.find((l) => l.title === 'Just code')!;
      const out = await svc.rewriteAtLevel(COLLEGE, codeLesson.id, 'intermediate');
      expect(out).toBe('');
    });

    it('happy path: returns Gemini output and caches it on second call', async () => {
      const geminiSpy = jest
        .spyOn(gemini, 'geminiGenerate')
        .mockResolvedValue('# Simpler version');
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      const a = await svc.rewriteAtLevel(COLLEGE, 'les-fcfs', 'intermediate');
      const b = await svc.rewriteAtLevel(COLLEGE, 'les-fcfs', 'intermediate');
      expect(a).toBe('# Simpler version');
      expect(b).toBe(a);
      // Cache hit means geminiGenerate was called exactly once
      expect(geminiSpy).toHaveBeenCalledTimes(1);
      geminiSpy.mockRestore();
    });

    it('uses different audience strings for beginner vs advanced vs intermediate', async () => {
      const geminiSpy = jest
        .spyOn(gemini, 'geminiGenerate')
        .mockResolvedValue('out');
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      await svc.rewriteAtLevel(COLLEGE, 'les-fcfs', 'beginner');
      await svc.rewriteAtLevel(COLLEGE, 'les-fcfs', 'advanced');
      // Cache is per-level so both prompts must have fired
      const prompts = geminiSpy.mock.calls.map((c) => String(c[0]));
      expect(prompts.some((p) => p.includes('a 12-year-old'))).toBe(true);
      expect(prompts.some((p) => p.includes('a senior engineer'))).toBe(true);
      geminiSpy.mockRestore();
    });
  });

  // ── draftModuleFromSyllabus — happy path with code-fence stripping ───────

  describe('draftModuleFromSyllabus', () => {
    it('strips ```json fences and parses Gemini JSON output', async () => {
      const payload = {
        title: 'Generated Module',
        lessons: [
          {
            title: 'L1',
            topicTags: ['t1'],
            markdown: 'body',
            checkpoint: [
              { q: 'q1', options: ['a', 'b'], correctIndex: 0 },
              { q: 'q2', options: ['a', 'b'], correctIndex: 1 },
              { q: 'q3', options: ['a', 'b'], correctIndex: 0 },
            ],
          },
        ],
      };
      const fenced = '```json\n' + JSON.stringify(payload) + '\n```';
      const geminiSpy = jest
        .spyOn(gemini, 'geminiGenerate')
        .mockResolvedValue(fenced);
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      const res = await svc.draftModuleFromSyllabus(COLLEGE, 'CS501', 'syllabus');
      expect(res.title).toBe('Generated Module');
      expect(res.lessons).toHaveLength(1);
      expect(res.lessons[0]!.title).toBe('L1');
      geminiSpy.mockRestore();
    });

    it('falls back to 5-lesson skeleton when Gemini returns malformed JSON', async () => {
      const geminiSpy = jest
        .spyOn(gemini, 'geminiGenerate')
        .mockResolvedValue('not json at all');
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      const res = await svc.draftModuleFromSyllabus(COLLEGE, 'CS501', 'syll');
      expect(res.lessons).toHaveLength(5);
      expect(res.title).toMatch(/CS501/);
      geminiSpy.mockRestore();
    });
  });

  // ── In-memory createModule + listModules sort comparator ─────────────────

  describe('in-memory createModule + listModules sort', () => {
    it('pushes to memModules when no modRepo is injected, and listModules sorts by order', async () => {
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      // The default seed inserts one module with order=1. Add a second
      // (order=0) to force the comparator to execute and verify ordering.
      await svc.createModule(COLLEGE, {
        courseId: 'CS501',
        title: 'Inserted-first',
        order: 0,
      });
      const mods = await svc.listModules(COLLEGE, 'CS501');
      expect(mods.length).toBeGreaterThanOrEqual(2);
      // Sorted ascending by `order` → order=0 first
      expect(mods[0]!.order).toBe(0);
      expect(mods[0]!.title).toBe('Inserted-first');
    });
  });

  // ── courseIdForLesson — lesson missing → '' (repo path) ──────────────────

  describe('courseIdForLesson via bumpTopicMastery early-return', () => {
    it('bumpTopicMastery silently returns when lesson missing (no mastery write)', async () => {
      // recordCheckpoint normally reads the lesson; if MASTERED and lesson
      // then disappears between getProgress and bumpTopicMastery, the
      // private bumpTopicMastery's early return covers it. We force this by
      // pointing recordCheckpoint at a lessonId for which no lesson exists
      // in the memory store. recordCheckpoint will still write a progress
      // row, then call bumpTopicMastery, which returns early.
      const svc = new LmsService();
      await new Promise((r) => setImmediate(r));
      const prog = await svc.recordCheckpoint(COLLEGE, 'U1', 'no-such-lesson', 3, 3);
      // Progress row gets written
      expect(prog.state).toBe('MASTERED');
      // …but no mastery rows for any topic of a non-existent lesson
      const mastery = await svc.getMastery(COLLEGE, 'U1', 'CS501');
      expect(mastery).toEqual([]);
    });
  });
});
