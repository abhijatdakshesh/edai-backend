import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LmsExtensionsService } from './lms-extensions.service';
import { LmsService } from './lms.service';

describe('LmsExtensionsService', () => {
  let ext: LmsExtensionsService;
  let lms: LmsService;
  const collegeId = 'rvce';
  const usn = '1RV21CS001';

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LmsExtensionsService, LmsService],
    }).compile();
    ext = moduleRef.get(LmsExtensionsService);
    lms = moduleRef.get(LmsService);
  });

  it('lists seeded FCFS assignment for les-fcfs', () => {
    const rows = ext.listAssignments(collegeId, 'les-fcfs', true);
    expect(rows.some((a) => a.id === 'asgn-fcfs-lab')).toBe(true);
  });

  it('tracks learning streak on touch', () => {
    const first = ext.touchStreak(collegeId, usn);
    expect(first.currentStreak).toBeGreaterThanOrEqual(1);
    const again = ext.getStreak(collegeId, usn);
    expect(again.currentStreak).toBe(first.currentStreak);
  });

  it('blocks les-sjf until les-fcfs is mastered', async () => {
    await expect(ext.assertLessonUnlocked(collegeId, usn, 'les-sjf')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns adaptive quiz questions for enrolled course', async () => {
    const qs = await ext.getAdaptiveQuiz(collegeId, usn, 'CS501');
    expect(qs.length).toBeGreaterThan(0);
    expect(qs[0]).toHaveProperty('question');
  });

  it('grades quiz answers', async () => {
    const qs = await ext.getAdaptiveQuiz(collegeId, usn, 'CS501', 2);
    const result = ext.gradeQuiz(collegeId, usn, 'CS501', [
      { questionId: qs[0]!.id, selectedIndex: qs[0]!.correctIndex },
      { questionId: qs[1]!.id, selectedIndex: -1 },
    ]);
    expect(result.total).toBe(2);
    expect(result.score).toBe(1);
  });

  it('exports NAAC LMS evidence payload', () => {
    const doc = ext.naacLmsExport(collegeId, 'CS501');
    expect(doc).toMatchObject({ collegeId, courseId: 'CS501', activeLearners: expect.any(Number) });
  });

  it('bulk import returns draft from syllabus', async () => {
    const res = await ext.bulkImportSyllabus(collegeId, 'CS501', 'Unit 1: CPU scheduling\nUnit 2: Memory');
    expect(res.status).toBe('DRAFT_READY');
    expect(res.draft.title).toBeTruthy();
    expect(res.draft.lessons.length).toBeGreaterThan(0);
    expect(res.message).toContain('authoring');
    void lms;
  });
});
