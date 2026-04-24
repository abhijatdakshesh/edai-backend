import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PromotionService, PromotionBatch } from './promotion.service';

const makeBatch = (overrides: Partial<PromotionBatch> = {}): PromotionBatch => ({
  id: 'promo-test',
  className: 'CSE-A Sem 5',
  fromSemester: 5,
  toSemester: 6,
  academicYear: '2025-26',
  dept: 'CSE',
  status: 'PENDING',
  promotedAt: null,
  stats: { eligible: 55, detained: 5, conditional: 2, total: 60 },
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('PromotionService', () => {
  let service: PromotionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromotionService],
    }).compile();
    service = module.get<PromotionService>(PromotionService);
    service.batches = [];
  });

  describe('getBatches()', () => {
    it('returns empty array after reset', () => {
      expect(service.getBatches()).toHaveLength(0);
    });

    it('returns all batches', () => {
      service.batches.push(makeBatch({ id: 'p1' }), makeBatch({ id: 'p2' }));
      expect(service.getBatches()).toHaveLength(2);
    });
  });

  describe('getBatchById()', () => {
    it('returns the batch for a valid id', () => {
      service.batches.push(makeBatch({ id: 'promo-test' }));
      expect(service.getBatchById('promo-test').dept).toBe('CSE');
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => service.getBatchById('no-such-id')).toThrow(NotFoundException);
    });
  });

  describe('generate()', () => {
    it('creates a PENDING batch with correct semester range', () => {
      const batch = service.generate(5, 'CSE');
      expect(batch.fromSemester).toBe(5);
      expect(batch.toSemester).toBe(6);
      expect(batch.status).toBe('PENDING');
      expect(batch.promotedAt).toBeNull();
    });

    it('throws when semester >= 8 (VTU 4-year boundary)', () => {
      expect(() => service.generate(8, 'CSE')).toThrow('Semester cannot exceed 8');
      expect(() => service.generate(9, 'CSE')).toThrow('Semester cannot exceed 8');
    });

    it('accepts semester 7 as last valid', () => {
      expect(() => service.generate(7, 'ECE')).not.toThrow();
    });

    it('uses provided stats', () => {
      const stats = { eligible: 50, detained: 5, conditional: 3, total: 55 };
      expect(service.generate(3, 'ME', stats).stats).toEqual(stats);
    });

    it('defaults stats to zeros when not provided', () => {
      expect(service.generate(1, 'CIVIL').stats).toEqual({ eligible: 0, detained: 0, conditional: 0, total: 0 });
    });

    it('appends batch to batches array', () => {
      service.generate(5, 'CSE');
      expect(service.batches).toHaveLength(1);
    });
  });

  describe('generate() — academicYear June rollover', () => {
    afterEach(() => jest.useRealTimers());

    it('returns current-year format when month >= 5 (June or later)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-07-01'));
      expect(service.generate(5, 'CSE').academicYear).toBe('2025-26');
    });

    it('returns previous-year format when month < 5 (before June)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-15'));
      expect(service.generate(5, 'CSE').academicYear).toBe('2025-26');
    });

    it('handles exact June 1 boundary', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-06-01'));
      expect(service.generate(5, 'CSE').academicYear).toBe('2025-26');
    });
  });

  describe('promote()', () => {
    it('sets status to PROMOTED and returns promotedAt', () => {
      service.batches.push(makeBatch({ id: 'p1' }));
      const result = service.promote('p1');
      expect(result.ok).toBe(true);
      expect(result.batchId).toBe('p1');
      expect(result.promotedAt).toBeDefined();
      expect(service.batches[0].status).toBe('PROMOTED');
    });

    it('throws NotFoundException for unknown batchId', () => {
      expect(() => service.promote('no-batch')).toThrow(NotFoundException);
    });
  });

  describe('override()', () => {
    it('sets status to OVERRIDDEN and returns overrideCount', () => {
      service.batches.push(makeBatch({ id: 'p2', dept: 'ECE' }));
      const result = service.override('p2', [
        { usn: '1RV21EC001', decision: 'PROMOTE' },
        { usn: '1RV21EC005', decision: 'DETAIN' },
      ]);
      expect(result.ok).toBe(true);
      expect(result.overrideCount).toBe(2);
      expect(service.batches[0].status).toBe('OVERRIDDEN');
    });

    it('throws NotFoundException for unknown batchId', () => {
      expect(() => service.override('no-batch', [])).toThrow(NotFoundException);
    });

    it('returns overrideCount of 0 for empty array', () => {
      service.batches.push(makeBatch({ id: 'p3' }));
      expect(service.override('p3', []).overrideCount).toBe(0);
    });
  });

  describe('getDetentionList()', () => {
    it('returns all 4 detained students when no filters applied', () => {
      expect(service.getDetentionList()).toHaveLength(4);
    });

    it('filters by dept', () => {
      const result = service.getDetentionList('CSE');
      expect(result.every((s) => s.dept === 'CSE')).toBe(true);
    });

    it('filters by semester', () => {
      const result = service.getDetentionList(undefined, 5);
      expect(result.every((s) => s.semester === 5)).toBe(true);
    });

    it('filters by both dept and semester', () => {
      const result = service.getDetentionList('CSE', 5);
      expect(result).toHaveLength(2);
      expect(result.every((s) => s.dept === 'CSE' && s.semester === 5)).toBe(true);
    });

    it('returns empty array for dept with no detained students', () => {
      expect(service.getDetentionList('CHEM')).toHaveLength(0);
    });

    it('includes student detained for attendance below 75% (ME, Sem 3)', () => {
      const result = service.getDetentionList('ME', 3);
      const student = result.find((s) => s.usn === '1RV21ME008');
      expect(student).toBeDefined();
      expect(student!.attendancePct).toBeLessThan(75);
    });
  });
});
