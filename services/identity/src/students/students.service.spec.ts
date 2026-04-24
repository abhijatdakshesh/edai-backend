import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { StudentsService } from './students.service';

describe('StudentsService', () => {
  let service: StudentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StudentsService],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
  });

  // ─── findById ────────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the seeded student when requester is the student itself (by userId)', () => {
      const result = service.findById('s-1', 'u-s-1');
      expect(result.id).toBe('s-1');
      expect(result.name).toBe('Aarav Sharma');
    });

    it('returns the seeded student when requester is the linked parent p-1', () => {
      const result = service.findById('s-1', 'p-1');
      expect(result.id).toBe('s-1');
    });

    it('throws NotFoundException for non-existent student id', () => {
      expect(() => service.findById('s-nonexistent', 'u-s-1')).toThrow(NotFoundException);
    });

    it('throws ForbiddenException for unlinked requester', () => {
      expect(() => service.findById('s-1', 'random-requester')).toThrow(ForbiddenException);
    });

    it('allows access when requesterId matches the student.id directly', () => {
      const result = service.findById('s-1', 's-1');
      expect(result.id).toBe('s-1');
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns a new student with generated id', () => {
      const data = {
        userId: 'u-new',
        sapId: 'SAP999',
        usn: '1RV22CS999',
        name: 'New Student',
        dob: '2004-01-01',
        sectionId: 'CS-B',
        institutionId: 'rvce',
      };
      const result = service.create(data);
      expect(result.id).toBeDefined();
      expect(result.name).toBe('New Student');
      expect(result.createdAt).toBeDefined();
    });
  });

  // ─── addLink ─────────────────────────────────────────────────────────────────

  describe('addLink()', () => {
    it('creates a new link between parent and student', () => {
      const link = service.addLink('p-new', 's-1');
      expect(link.parentId).toBe('p-new');
      expect(link.studentId).toBe('s-1');
      expect(link.isPrimary).toBe(false);
    });

    it('returns existing link when called again (idempotent)', () => {
      const link1 = service.addLink('p-new', 's-1');
      const link2 = service.addLink('p-new', 's-1');
      expect(link1.id).toBe(link2.id);
    });

    it('allows newly added parent to access student via findById', () => {
      service.addLink('p-new', 's-1');
      const result = service.findById('s-1', 'p-new');
      expect(result.id).toBe('s-1');
    });
  });
});
