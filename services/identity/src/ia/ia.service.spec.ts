import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IaService, IASubmission } from './ia.service';

describe('IaService', () => {
  let service: IaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IaService],
    }).compile();

    service = module.get<IaService>(IaService);
  });

  // ─── getMarks ───────────────────────────────────────────────────────────────

  describe('getMarks()', () => {
    it('returns entries for a specific subject and sem', () => {
      service.entries.push(
        { usn: 'U1', name: 'Alice', ia1: 18, ia2: 17, ia3: 19, subjectCode: 'CS301', sem: 5 },
        { usn: 'U2', name: 'Bob', ia1: 15, ia2: 16, ia3: 14, subjectCode: 'CS302', sem: 5 },
      );
      const result = service.getMarks('CS301', 5);
      expect(result).toHaveLength(1);
      expect(result[0].usn).toBe('U1');
    });

    it('returns empty array when no matching entries', () => {
      expect(service.getMarks('NO_SUBJECT', 1)).toEqual([]);
    });
  });

  // ─── saveMarks ──────────────────────────────────────────────────────────────

  describe('saveMarks()', () => {
    it('creates new entries and returns a DRAFT submission', () => {
      const marks = [
        { usn: 'U1', ia1: 18, ia2: 17, ia3: 19 },
        { usn: 'U2', ia1: 14, ia2: 15, ia3: 16 },
      ];
      const result = service.saveMarks('CS301', 5, marks, 'teacher-1');
      expect(result.status).toBe('DRAFT');
      expect(result.subjectCode).toBe('CS301');
      expect(result.sem).toBe(5);
      expect(service.entries).toHaveLength(2);
    });

    it('updates existing entries instead of creating duplicates', () => {
      service.entries.push({ usn: 'U1', name: 'Alice', ia1: 10, ia2: 10, ia3: 10, subjectCode: 'CS301', sem: 5 });
      service.saveMarks('CS301', 5, [{ usn: 'U1', ia1: 18, ia2: 19, ia3: 20 }], 'teacher-1');
      expect(service.entries).toHaveLength(1);
      expect(service.entries[0].ia1).toBe(18);
    });

    it('updates existing submission instead of creating duplicate', () => {
      service.saveMarks('CS301', 5, [{ usn: 'U1', ia1: 18, ia2: 17, ia3: 19 }], 'teacher-1');
      service.saveMarks('CS301', 5, [{ usn: 'U2', ia1: 10, ia2: 10, ia3: 10 }], 'teacher-1');
      expect(service.submissions).toHaveLength(1);
    });
  });

  // ─── submitForReview ────────────────────────────────────────────────────────

  describe('submitForReview()', () => {
    it('changes status to SUBMITTED', () => {
      service.saveMarks('CS301', 5, [{ usn: 'U1', ia1: 18, ia2: 17, ia3: 19 }], 'teacher-1');
      const result = service.submitForReview('CS301', 5, 'teacher-1');
      expect(result.status).toBe('SUBMITTED');
    });

    it('throws NotFoundException when no matching submission', () => {
      expect(() => service.submitForReview('NO_SUBJECT', 1, 'teacher-1')).toThrow(NotFoundException);
    });
  });

  // ─── getAllSubmissions ───────────────────────────────────────────────────────

  describe('getAllSubmissions()', () => {
    it('returns all submissions', () => {
      service.saveMarks('CS301', 5, [{ usn: 'U1', ia1: 18, ia2: 17, ia3: 19 }], 'teacher-1');
      service.saveMarks('CS302', 5, [{ usn: 'U1', ia1: 15, ia2: 16, ia3: 14 }], 'teacher-2');
      expect(service.getAllSubmissions()).toHaveLength(2);
    });

    it('returns empty array when no submissions', () => {
      expect(service.getAllSubmissions()).toEqual([]);
    });
  });

  // ─── confirm ────────────────────────────────────────────────────────────────

  describe('confirm()', () => {
    it('sets status to CONFIRMED', () => {
      service.saveMarks('CS301', 5, [{ usn: 'U1', ia1: 18, ia2: 17, ia3: 19 }], 'teacher-1');
      const sub = service.submissions[0];
      const result = service.confirm(sub.id);
      expect(result.status).toBe('CONFIRMED');
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => service.confirm('no-such-id')).toThrow(NotFoundException);
    });
  });

  // ─── sendReminders ──────────────────────────────────────────────────────────

  describe('sendReminders()', () => {
    it('returns the list of reminded teacherIds', () => {
      const result = service.sendReminders(['t1', 't2', 't3']);
      expect(result).toEqual({ reminded: ['t1', 't2', 't3'] });
    });

    it('handles empty array', () => {
      expect(service.sendReminders([])).toEqual({ reminded: [] });
    });
  });

  // ─── uploadResults ──────────────────────────────────────────────────────────

  describe('uploadResults()', () => {
    it('returns a queued message with subjectCode and sem', () => {
      const result = service.uploadResults('CS301', 5);
      expect(result.message).toContain('CS301');
      expect(result.message).toContain('5');
    });
  });
});
