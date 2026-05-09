import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WellnessService, CounselorSlot, StudyTask } from './wellness.service';

function makeSlot(overrides: Partial<CounselorSlot> = {}): CounselorSlot {
  return {
    id: 'slot-1',
    dateTime: '2026-05-01T10:00:00Z',
    counsellorId: 'counsellor-1',
    isBooked: false,
    ...overrides,
  };
}

describe('WellnessService', () => {
  let service: WellnessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WellnessService],
    }).compile();

    service = module.get<WellnessService>(WellnessService);
  });

  // ─── getSlots ───────────────────────────────────────────────────────────────

  describe('getSlots()', () => {
    it('returns only unbooked slots', () => {
      service.slots.push(
        makeSlot({ id: 's1', isBooked: false }),
        makeSlot({ id: 's2', isBooked: true }),
      );
      const result = service.getSlots();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });

    it('returns empty array when no slots exist', () => {
      expect(service.getSlots()).toEqual([]);
    });
  });

  // ─── getMySessions ──────────────────────────────────────────────────────────

  describe('getMySessions()', () => {
    it('returns sessions for the given usn', () => {
      service.sessions.push(
        { id: 'sess-1', slotId: 's1', studentUsn: 'USN001', reason: 'stress', status: 'BOOKED' },
        { id: 'sess-2', slotId: 's2', studentUsn: 'USN002', reason: 'career', status: 'BOOKED' },
      );
      const result = service.getMySessions('USN001');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sess-1');
    });

    it('returns empty array for unknown usn', () => {
      expect(service.getMySessions('NO_USN')).toEqual([]);
    });
  });

  // ─── bookSession ────────────────────────────────────────────────────────────

  describe('bookSession()', () => {
    it('books a slot and creates a session', () => {
      service.slots.push(makeSlot({ id: 'slot-1', isBooked: false }));
      const result = service.bookSession('USN001', 'slot-1', 'exam stress');
      expect(result.status).toBe('BOOKED');
      expect(result.studentUsn).toBe('USN001');
      expect(result.reason).toBe('exam stress');
      expect(service.slots[0].isBooked).toBe(true);
    });

    it('throws NotFoundException for unknown slotId', () => {
      expect(() => service.bookSession('USN001', 'no-slot', 'reason')).toThrow(NotFoundException);
    });
  });

  // ─── getRiskScore ───────────────────────────────────────────────────────────

  describe('getRiskScore()', () => {
    it('returns LOW risk score by default', () => {
      const result = service.getRiskScore('USN001');
      expect(result.level).toBe('LOW');
      expect(result.score).toBe(30);
    });

    it('returns stored risk score when present', () => {
      service.riskScores.set('USN001', { score: 85, level: 'HIGH', factors: ['Low attendance'] });
      const result = service.getRiskScore('USN001');
      expect(result.level).toBe('HIGH');
      expect(result.score).toBe(85);
    });
  });

  // ─── getStudyPlan ───────────────────────────────────────────────────────────

  describe('getStudyPlan()', () => {
    it('returns tasks for the given usn', () => {
      service.studyTasks.push(
        { id: 't1', usn: 'USN001', subject: 'DS', title: 'Revise Trees', done: false, dueDate: '2026-05-10' },
        { id: 't2', usn: 'USN002', subject: 'DBMS', title: 'SQL', done: true, dueDate: '2026-05-11' },
      );
      const result = service.getStudyPlan('USN001');
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('t1');
    });

    it('returns empty tasks array when no tasks for usn', () => {
      // The plan now exposes id/studentUsn/streakDays/totalTasks/etc.
      // Only tasks itself must be empty for an unknown USN.
      const plan = service.getStudyPlan('NO_USN');
      expect(plan.tasks).toEqual([]);
      expect(plan.totalTasks).toBe(0);
      expect(plan.completedTasks).toBe(0);
      expect(plan.studentUsn).toBe('NO_USN');
    });
  });

  // ─── updateTask ─────────────────────────────────────────────────────────────

  describe('updateTask()', () => {
    it('sets done to true on an existing task', () => {
      service.studyTasks.push({ id: 't1', usn: 'USN001', subject: 'DS', title: 'Revise Trees', done: false, dueDate: '2026-05-10' });
      const result = service.updateTask('t1', true);
      expect(result.done).toBe(true);
    });

    it('sets done to false (uncomplete a task)', () => {
      service.studyTasks.push({ id: 't1', usn: 'USN001', subject: 'DS', title: 'Revise Trees', done: true, dueDate: '2026-05-10' });
      const result = service.updateTask('t1', false);
      expect(result.done).toBe(false);
    });

    it('throws NotFoundException for unknown taskId', () => {
      expect(() => service.updateTask('no-task', true)).toThrow(NotFoundException);
    });
  });

  // ─── getResources ───────────────────────────────────────────────────────────

  describe('getResources()', () => {
    it('returns the static wellness resources array', () => {
      const result = service.getResources();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].title).toBeDefined();
    });
  });

  // ─── assessStress ─────────────────────────────────────────────────────────

  describe('assessStress()', () => {
    it('returns LOW level for low average score', () => {
      const result = service.assessStress('USN001', { q1: 1, q2: 1, q3: 1 });
      expect(result.level).toBe('LOW');
      expect(result.score).toBeLessThan(40);
      expect(result.recommendations[0]).toContain('healthy');
    });

    it('returns MEDIUM level for mid average score', () => {
      const result = service.assessStress('USN001', { q1: 3, q2: 3, q3: 3 });
      expect(result.level).toBe('MEDIUM');
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(70);
      expect(result.recommendations).toContain('Try mindfulness exercises');
    });

    it('returns HIGH level for high average score', () => {
      const result = service.assessStress('USN001', { q1: 5, q2: 5, q3: 5 });
      expect(result.level).toBe('HIGH');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.recommendations).toContain('Book a counseling session');
    });

    it('defaults avg to 3 (MEDIUM) when answers is empty', () => {
      const result = service.assessStress('USN001', {});
      expect(result.score).toBe(60);
      expect(result.level).toBe('MEDIUM');
    });
  });
});
