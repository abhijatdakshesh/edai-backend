/**
 * Unit tests: lms.controller.ts
 *
 * Covers every public route (listModules → getFeatures) and every guard:
 *   - tenant resolution via resolveCollegeId
 *   - feature-flag denial via requireFeature (lms_assignments)
 *   - 400 on missing query/path params
 *   - 404 on missing lesson
 *   - 400 on missing USN claim
 *   - score computation in submitCheckpoint (correct vs wrong vs partial)
 *
 * Strategy: stub LmsService entirely; pass a synthetic `req` object carrying
 * the JWT-shaped claims the controller reads. We never start NestJS — we
 * exercise the controller methods directly with plain mocks because that's
 * faster, deterministic, and matches the project's existing spec style
 * (see chatbot.controller.spec.ts).
 */

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { LmsController } from './lms.controller';
import type { LmsService } from './lms.service';

// Mock the feature-flag helper so we can flip `lms_assignments` per test.
const featureBag = { lms_assignments: true, lms_quizzes: true };
jest.mock('./tenant-context', () => ({
  resolveCollegeId: (req: any) =>
    req?.user?.collegeId ?? req?.user?.institutionId ?? 'col-default',
  getCollegeFeatures: () => featureBag,
}));

function makeReq(overrides: Record<string, unknown> = {}): any {
  return {
    user: {
      sub: '1RV21CS001',
      collegeId: 'col-rvce',
      institutionId: 'rvce',
      ...overrides,
    },
  };
}

function buildSvcMock() {
  const svc = {
    listModules: jest.fn(),
    createModule: jest.fn(),
    listLessons: jest.fn(),
    getLesson: jest.fn(),
    createLesson: jest.fn(),
    updateLesson: jest.fn(),
    recordCheckpoint: jest.fn(),
    listProgressForCourse: jest.fn(),
    getMastery: jest.fn(),
    rewriteAtLevel: jest.fn(),
    draftModuleFromSyllabus: jest.fn(),
  } as unknown as jest.Mocked<LmsService>;
  return svc;
}

describe('LmsController', () => {
  let svc: jest.Mocked<LmsService>;
  let ctrl: LmsController;

  beforeEach(() => {
    svc = buildSvcMock();
    ctrl = new LmsController(svc);
    featureBag.lms_assignments = true;
  });

  // ── listModules ─────────────────────────────────────────────────────────

  it('listModules: 400 when courseId missing', async () => {
    await expect(ctrl.listModules('', makeReq())).rejects.toThrow(
      BadRequestException,
    );
    expect(svc.listModules).not.toHaveBeenCalled();
  });

  it('listModules: resolves collegeId from req and proxies to service', async () => {
    svc.listModules.mockResolvedValue([{ id: 'm1' } as any]);
    const out = await ctrl.listModules('CS501', makeReq());
    expect(svc.listModules).toHaveBeenCalledWith('col-rvce', 'CS501');
    expect(out).toEqual([{ id: 'm1' }]);
  });

  // ── createModule ────────────────────────────────────────────────────────

  it('createModule: forwards body with resolved collegeId', async () => {
    svc.createModule.mockResolvedValue({ id: 'm-new' } as any);
    const body = { courseId: 'CS501', title: 'OS Basics' };
    const out = await ctrl.createModule(body, makeReq());
    expect(svc.createModule).toHaveBeenCalledWith('col-rvce', body);
    expect(out).toEqual({ id: 'm-new' });
  });

  // ── listLessons / getLesson / createLesson / updateLesson ───────────────

  it('listLessons: proxies to service with collegeId + moduleId', async () => {
    svc.listLessons.mockResolvedValue([{ id: 'l1' } as any]);
    const out = await ctrl.listLessons('m1', makeReq());
    expect(svc.listLessons).toHaveBeenCalledWith('col-rvce', 'm1');
    expect(out[0].id).toBe('l1');
  });

  it('getLesson: 404 when service returns null', async () => {
    svc.getLesson.mockResolvedValue(null as any);
    await expect(ctrl.getLesson('does-not-exist', makeReq())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getLesson: forwards USN from req.user.sub', async () => {
    svc.getLesson.mockResolvedValue({ id: 'l1' } as any);
    await ctrl.getLesson('l1', makeReq());
    expect(svc.getLesson).toHaveBeenCalledWith('col-rvce', 'l1', '1RV21CS001');
  });

  it('getLesson: falls back to req.user.usn when sub is absent', async () => {
    svc.getLesson.mockResolvedValue({ id: 'l1' } as any);
    const req = makeReq();
    delete req.user.sub;
    req.user.usn = '1RV21CS999';
    await ctrl.getLesson('l1', req);
    expect(svc.getLesson).toHaveBeenCalledWith('col-rvce', 'l1', '1RV21CS999');
  });

  it('createLesson: forwards body to service', async () => {
    svc.createLesson.mockResolvedValue({ id: 'l-new' } as any);
    await ctrl.createLesson({ title: 'X', moduleId: 'm1' } as any, makeReq());
    expect(svc.createLesson).toHaveBeenCalledWith('col-rvce', {
      title: 'X',
      moduleId: 'm1',
    });
  });

  it('updateLesson: 404 when service returns null', async () => {
    svc.updateLesson.mockResolvedValue(null as any);
    await expect(
      ctrl.updateLesson('l-missing', { title: 'X' }, makeReq()),
    ).rejects.toThrow(NotFoundException);
  });

  it('updateLesson: returns updated lesson on success', async () => {
    svc.updateLesson.mockResolvedValue({ id: 'l1', title: 'Y' } as any);
    const out = await ctrl.updateLesson('l1', { title: 'Y' }, makeReq());
    expect(out.title).toBe('Y');
  });

  // ── submitCheckpoint ────────────────────────────────────────────────────

  it('submitCheckpoint: 400 when USN missing from token', async () => {
    const req = makeReq();
    delete req.user.sub;
    delete req.user.usn;
    await expect(
      ctrl.submitCheckpoint('l1', { answers: [0] }, req),
    ).rejects.toThrow(BadRequestException);
    expect(svc.getLesson).not.toHaveBeenCalled();
  });

  it('submitCheckpoint: 404 when lesson missing', async () => {
    svc.getLesson.mockResolvedValue(null as any);
    await expect(
      ctrl.submitCheckpoint('l-missing', { answers: [0, 1] }, makeReq()),
    ).rejects.toThrow(NotFoundException);
  });

  it('submitCheckpoint: scores answers against correctIndex (3 correct of 3)', async () => {
    svc.getLesson.mockResolvedValue({
      id: 'l1',
      checkpoint: [
        { correctIndex: 0 },
        { correctIndex: 2 },
        { correctIndex: 1 },
      ],
    } as any);
    svc.recordCheckpoint.mockResolvedValue({ state: 'MASTERED' } as any);
    const out = await ctrl.submitCheckpoint(
      'l1',
      { answers: [0, 2, 1] },
      makeReq(),
    );
    expect(out).toEqual({ score: 3, total: 3, state: 'MASTERED' });
    expect(svc.recordCheckpoint).toHaveBeenCalledWith(
      'col-rvce',
      '1RV21CS001',
      'l1',
      3,
      3,
    );
  });

  it('submitCheckpoint: partial credit (2 of 3 correct, 1 wrong)', async () => {
    svc.getLesson.mockResolvedValue({
      id: 'l1',
      checkpoint: [
        { correctIndex: 0 },
        { correctIndex: 2 },
        { correctIndex: 1 },
      ],
    } as any);
    svc.recordCheckpoint.mockResolvedValue({ state: 'IN_PROGRESS' } as any);
    const out = await ctrl.submitCheckpoint(
      'l1',
      { answers: [0, 9, 1] },
      makeReq(),
    );
    expect(out.score).toBe(2);
    expect(out.state).toBe('IN_PROGRESS');
  });

  it('submitCheckpoint: missing answers array scores zero (no client-side score injection)', async () => {
    svc.getLesson.mockResolvedValue({
      id: 'l1',
      checkpoint: [{ correctIndex: 0 }, { correctIndex: 1 }],
    } as any);
    svc.recordCheckpoint.mockResolvedValue({ state: 'NOT_STARTED' } as any);
    const out = await ctrl.submitCheckpoint('l1', {} as any, makeReq());
    // Critical: the controller must compute score itself — never trust a
    // `body.score` from the client.
    expect(out.score).toBe(0);
    expect(out.total).toBe(2);
  });

  // ── getProgress / getMastery ────────────────────────────────────────────

  it('getProgress: 400 when courseId missing', async () => {
    await expect(ctrl.getProgress('', makeReq())).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getProgress: 400 when USN missing from token', async () => {
    const req = makeReq();
    delete req.user.sub;
    delete req.user.usn;
    await expect(ctrl.getProgress('CS501', req)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getProgress: returns service result', async () => {
    svc.listProgressForCourse.mockResolvedValue([
      { lessonId: 'l1', state: 'MASTERED' } as any,
    ]);
    const out = await ctrl.getProgress('CS501', makeReq());
    expect(svc.listProgressForCourse).toHaveBeenCalledWith(
      'col-rvce',
      '1RV21CS001',
      'CS501',
    );
    expect(out).toHaveLength(1);
  });

  it('getMastery: 400 when courseId missing', async () => {
    await expect(ctrl.getMastery('', makeReq())).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getMastery: 400 when USN missing from token', async () => {
    const req = makeReq();
    delete req.user.sub;
    delete req.user.usn;
    await expect(ctrl.getMastery('CS501', req)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getMastery: returns service result', async () => {
    svc.getMastery.mockResolvedValue([
      { topic: 'fcfs', masteryScore: 0.8 } as any,
    ]);
    const out = await ctrl.getMastery('CS501', makeReq());
    expect(svc.getMastery).toHaveBeenCalledWith(
      'col-rvce',
      '1RV21CS001',
      'CS501',
    );
    expect(out[0].topic).toBe('fcfs');
  });

  // ── eli5 ────────────────────────────────────────────────────────────────

  it('eli5: defaults level to "beginner" when body absent', async () => {
    svc.rewriteAtLevel.mockResolvedValue('Easy explanation');
    const out = await ctrl.eli5('l1', undefined as any, makeReq());
    expect(svc.rewriteAtLevel).toHaveBeenCalledWith(
      'col-rvce',
      'l1',
      'beginner',
    );
    expect(out).toEqual({ markdown: 'Easy explanation', level: 'beginner' });
  });

  it('eli5: forwards explicit level', async () => {
    svc.rewriteAtLevel.mockResolvedValue('Advanced explanation');
    const out = await ctrl.eli5('l1', { level: 'advanced' }, makeReq());
    expect(svc.rewriteAtLevel).toHaveBeenCalledWith(
      'col-rvce',
      'l1',
      'advanced',
    );
    expect(out.level).toBe('advanced');
  });

  it('eli5: empty-string level is NOT coalesced (?. only handles nullish, not "")', async () => {
    // The controller uses `body?.level ?? 'beginner'`. `??` keeps `''` as
    // a valid value (vs `||` which would coalesce). This test pins that
    // behaviour so a future refactor to `||` (which would also drop
    // 'intermediate' if someone passed `0`, etc.) is caught.
    svc.rewriteAtLevel.mockResolvedValue('B');
    await ctrl.eli5('l1', { level: '' as any }, makeReq());
    expect(svc.rewriteAtLevel).toHaveBeenCalledWith('col-rvce', 'l1', '');
  });

  // ── authoringDraft (feature-flag guard) ─────────────────────────────────

  it('authoringDraft: 400 when courseId missing', async () => {
    await expect(
      ctrl.authoringDraft({ syllabus: 'topic A\ntopic B' } as any, makeReq()),
    ).rejects.toThrow(BadRequestException);
  });

  it('authoringDraft: 400 when syllabus missing', async () => {
    await expect(
      ctrl.authoringDraft({ courseId: 'CS501' } as any, makeReq()),
    ).rejects.toThrow(BadRequestException);
  });

  it('authoringDraft: 403 when lms_assignments feature is disabled', async () => {
    featureBag.lms_assignments = false;
    await expect(
      ctrl.authoringDraft(
        { courseId: 'CS501', syllabus: 'OS topics' },
        makeReq(),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(svc.draftModuleFromSyllabus).not.toHaveBeenCalled();
  });

  it('authoringDraft: proxies to service when feature enabled', async () => {
    svc.draftModuleFromSyllabus.mockResolvedValue({
      title: 'OS Basics',
      lessons: [],
    } as any);
    const out = await ctrl.authoringDraft(
      { courseId: 'CS501', syllabus: 'OS topics' },
      makeReq(),
    );
    expect(svc.draftModuleFromSyllabus).toHaveBeenCalledWith(
      'col-rvce',
      'CS501',
      'OS topics',
    );
    expect(out.title).toBe('OS Basics');
  });

  // ── getFeatures ─────────────────────────────────────────────────────────

  it('getFeatures: returns resolved collegeId + feature bag', async () => {
    const out = await ctrl.getFeatures(makeReq());
    expect(out.collegeId).toBe('col-rvce');
    expect(out.features.lms_assignments).toBe(true);
    expect(out.features.lms_quizzes).toBe(true);
  });
});
