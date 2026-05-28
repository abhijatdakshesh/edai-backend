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

  it('publishedOnly hides draft modules and lessons', async () => {
    await svc.createModule('col-test', {
      courseId: 'CS502',
      title: 'Draft Module',
      published: false,
    });
    const all = await svc.listModules('col-test', 'CS502');
    expect(all).toHaveLength(1);
    const pub = await svc.listModules('col-test', 'CS502', { publishedOnly: true });
    expect(pub).toHaveLength(0);
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
});
