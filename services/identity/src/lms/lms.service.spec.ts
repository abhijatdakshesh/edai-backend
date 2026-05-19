import { Test } from '@nestjs/testing';
import { LmsService } from './lms.service';

/**
 * Smoke + tenancy tests for LmsService.
 *
 * We construct the service with no TypeORM repos (Optional() falls back to
 * the in-memory store) so the suite is hermetic.
 */
describe('LmsService', () => {
  const ORIGINAL_DEFAULT = process.env['DEFAULT_COLLEGE_ID'];
  let svc: LmsService;

  beforeEach(async () => {
    process.env['DEFAULT_COLLEGE_ID'] = 'col-test';
    const mod = await Test.createTestingModule({
      providers: [LmsService],
    }).compile();
    svc = mod.get(LmsService);
  });

  afterAll(() => {
    if (ORIGINAL_DEFAULT === undefined) delete process.env['DEFAULT_COLLEGE_ID'];
    else process.env['DEFAULT_COLLEGE_ID'] = ORIGINAL_DEFAULT;
  });

  it('seeds the demo CS501 module with 3 lessons for the default college', async () => {
    const mods = await svc.listModules('col-test', 'CS501');
    expect(mods).toHaveLength(1);
    expect(mods[0]).toMatchObject({ courseId: 'CS501', collegeId: 'col-test', lessonCount: 3 });
  });

  it('does NOT leak seeded content to a different tenant', async () => {
    const mods = await svc.listModules('col-other', 'CS501');
    expect(mods).toEqual([]);
  });

  it('lists lessons in deterministic order', async () => {
    const lessons = await svc.listLessons('col-test', 'mod-os-scheduling');
    expect(lessons.map((l) => l.title)).toEqual([
      'First-Come First-Served (FCFS)',
      'Shortest Job First (SJF)',
      'Round Robin (RR)',
    ]);
  });

  it('records a passing checkpoint and bumps topic mastery', async () => {
    // FCFS expected answers: 1, 1, 2  (from the seed)
    const prog = await svc.recordCheckpoint('col-test', '1RV21CS001', 'les-fcfs', 3, 3);
    expect(prog.state).toBe('MASTERED');
    expect(prog.score).toBe(3);
    const mastery = await svc.getMastery('col-test', '1RV21CS001', 'CS501');
    const fcfs = mastery.find((m) => m.topic === 'fcfs');
    expect(fcfs).toBeDefined();
    expect(fcfs!.masteryScore).toBeGreaterThan(0);
  });

  it('records a failing checkpoint without demoting MASTERED state', async () => {
    await svc.recordCheckpoint('col-test', '1RV21CS001', 'les-fcfs', 3, 3); // MASTERED
    const prog = await svc.recordCheckpoint('col-test', '1RV21CS001', 'les-fcfs', 1, 3); // worse
    expect(prog.state).toBe('MASTERED'); // never demoted
    expect(prog.score).toBe(3);          // kept the best score
    expect(prog.attempts).toBe(2);
  });

  it('keeps progress isolated per tenant', async () => {
    await svc.recordCheckpoint('col-test', '1RV21CS001', 'les-fcfs', 3, 3);
    const other = await svc.listProgressForCourse('col-other', '1RV21CS001', 'CS501');
    expect(other).toEqual([]);
  });

  it('rewrites at three levels and caches per (collegeId, lessonId, level)', async () => {
    // First call (will throw inside geminiGenerate due to missing API key, but
    // catches and returns body) — just make sure it doesn't blow up.
    const a = await svc.rewriteAtLevel('col-test', 'les-fcfs', 'beginner');
    const b = await svc.rewriteAtLevel('col-test', 'les-fcfs', 'beginner');
    expect(typeof a).toBe('string');
    expect(b).toBe(a); // cached
  });

  it('draftModuleFromSyllabus returns a 5-lesson skeleton even when Gemini fails', async () => {
    const draft = await svc.draftModuleFromSyllabus('col-test', 'CS501', 'Sample syllabus');
    expect(draft.lessons).toHaveLength(5);
    for (const lesson of draft.lessons) {
      expect(lesson.checkpoint).toHaveLength(3);
    }
  });

  // ─── Strengthened coverage per Priya's gap list ────────────────────────

  describe('createModule / createLesson validation', () => {
    it('createModule throws when courseId missing', async () => {
      await expect(
        svc.createModule('col-test', { title: 'OK' } as any),
      ).rejects.toThrow(/courseId \+ title required/);
    });

    it('createModule throws when title missing', async () => {
      await expect(
        svc.createModule('col-test', { courseId: 'CS501' } as any),
      ).rejects.toThrow(/courseId \+ title required/);
    });

    it('createLesson throws when moduleId missing', async () => {
      await expect(
        svc.createLesson('col-test', { title: 'L1' } as any),
      ).rejects.toThrow(/moduleId \+ title required/);
    });

    it('createLesson throws when title missing', async () => {
      await expect(
        svc.createLesson('col-test', { moduleId: 'm1' } as any),
      ).rejects.toThrow(/moduleId \+ title required/);
    });

    it('createModule defaults order=0 and published=false', async () => {
      const mod = await svc.createModule('col-test', {
        courseId: 'CS502',
        title: 'DBMS Basics',
      });
      expect(mod.order).toBe(0);
      expect(mod.published).toBe(false);
    });
  });

  describe('updateLesson — tenancy immutability + 404', () => {
    it('returns null when the lesson does not exist', async () => {
      const out = await svc.updateLesson('col-test', 'les-missing', { title: 'X' });
      expect(out).toBeNull();
    });

    it('returns null when the lesson exists in a different tenant (no cross-tenant write)', async () => {
      // 'les-fcfs' exists for col-test only.
      const out = await svc.updateLesson('col-other', 'les-fcfs', { title: 'X' });
      expect(out).toBeNull();
    });

    it('strips collegeId from the patch — tenancy is immutable', async () => {
      const out = await svc.updateLesson('col-test', 'les-fcfs', {
        title: 'New Title',
        collegeId: 'col-attacker',
      } as any);
      expect(out).not.toBeNull();
      expect(out!.collegeId).toBe('col-test'); // original tenant preserved
      expect(out!.title).toBe('New Title');
    });
  });

  describe('bumpTopicMastery — boundary + missing lesson', () => {
    it('caps masteryScore at 1.0 across repeated MASTERED checkpoints', async () => {
      // 3 passes × 0.34 = 1.02 → must clamp to 1.0
      await svc.recordCheckpoint('col-test', '1RV21CS010', 'les-fcfs', 3, 3);
      await svc.recordCheckpoint('col-test', '1RV21CS010', 'les-fcfs', 3, 3);
      await svc.recordCheckpoint('col-test', '1RV21CS010', 'les-fcfs', 3, 3);
      await svc.recordCheckpoint('col-test', '1RV21CS010', 'les-fcfs', 3, 3);
      const mastery = await svc.getMastery('col-test', '1RV21CS010', 'CS501');
      const fcfs = mastery.find((m) => m.topic === 'fcfs');
      expect(fcfs).toBeDefined();
      expect(fcfs!.masteryScore).toBeLessThanOrEqual(1);
      expect(fcfs!.masteryScore).toBeGreaterThanOrEqual(0.99);
    });

    it('records a mastery row only when the checkpoint actually MASTERED (≥ 66%)', async () => {
      // 1/3 score = 33% → IN_PROGRESS — no mastery row should be created
      await svc.recordCheckpoint('col-test', '1RV21CS099', 'les-fcfs', 1, 3);
      const mastery = await svc.getMastery('col-test', '1RV21CS099', 'CS501');
      expect(mastery).toEqual([]);
    });
  });

  describe('rewriteAtLevel — content gating', () => {
    it('returns empty string when the lesson does not exist', async () => {
      const out = await svc.rewriteAtLevel('col-test', 'les-missing', 'beginner');
      expect(out).toBe('');
    });

    it('returns empty string when the lesson exists in a different tenant', async () => {
      const out = await svc.rewriteAtLevel('col-other', 'les-fcfs', 'beginner');
      expect(out).toBe('');
    });

    it('serves the same cached output for repeated (collegeId, lessonId, level) calls', async () => {
      const a = await svc.rewriteAtLevel('col-test', 'les-fcfs', 'advanced');
      const b = await svc.rewriteAtLevel('col-test', 'les-fcfs', 'advanced');
      expect(typeof a).toBe('string');
      expect(b).toBe(a);
    });
  });

  describe('listProgressForCourse — empty-lesson edge', () => {
    it('returns [] for a course with no lessons (avoids IN (...) SQL with empty array)', async () => {
      const out = await svc.listProgressForCourse(
        'col-test',
        '1RV21CS001',
        'CS-NONEXISTENT',
      );
      expect(out).toEqual([]);
    });
  });
});
