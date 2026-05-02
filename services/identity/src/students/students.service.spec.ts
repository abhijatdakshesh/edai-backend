/**
 * StudentsService — unit tests (100% coverage)
 *
 * Two test suites:
 *   1. In-memory mode (no TypeORM repos injected — simulates no DATABASE_URL)
 *   2. DB mode (TypeORM repos mocked)
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StudentsService } from './students.service';
import { StudentEntity, ParentStudentLinkEntity } from '../entities/student-orm.entity';

// ─── In-memory mode ──────────────────────────────────────────────────────────

describe('StudentsService — in-memory mode (no DATABASE_URL)', () => {
  let service: StudentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [StudentsService],
    }).compile();
    service = module.get(StudentsService);
  });

  describe('findById()', () => {
    it('returns the seeded student when requester is the student (by userId)', async () => {
      const result = await service.findById('s-1', 'u-s-1');
      expect(result.id).toBe('s-1');
      expect(result.name).toBe('Aarav Sharma');
    });

    it('returns the seeded student when requester is linked parent p-1', async () => {
      const result = await service.findById('s-1', 'p-1');
      expect(result.id).toBe('s-1');
    });

    it('allows access when requesterId matches student.id directly', async () => {
      const result = await service.findById('s-1', 's-1');
      expect(result.id).toBe('s-1');
    });

    it('throws NotFoundException for non-existent student', async () => {
      await expect(service.findById('s-nonexistent', 'u-s-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for unlinked requester', async () => {
      await expect(service.findById('s-1', 'random-requester')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create()', () => {
    it('creates and returns a student with a generated id', async () => {
      const result = await service.create({
        userId: 'u-new', sapId: 'SAP999', usn: '1RV22CS999', name: 'New Student',
        dob: '2004-01-01', sectionId: 'CS-B', institutionId: 'rvce',
      });
      expect(result.id).toBeDefined();
      expect(result.name).toBe('New Student');
      expect(result.createdAt).toBeDefined();
    });

    it('infers parent language from homeState when not provided', async () => {
      const result = await service.create({
        userId: 'u-2', usn: '1RV22ME001', name: 'Tamil Student',
        institutionId: 'rvce', homeState: 'Tamil Nadu',
      });
      expect(result.parentPreferredLanguage).toBe('ta');
    });

    it('uses provided parentPreferredLanguage over inferred', async () => {
      const result = await service.create({
        userId: 'u-3', usn: '1RV22EC001', name: 'Hindi Student',
        institutionId: 'rvce', homeState: 'karnataka', parentPreferredLanguage: 'hi',
      });
      expect(result.parentPreferredLanguage).toBe('hi');
    });
  });

  describe('findContactByUsn()', () => {
    it('returns default phone/name for seeded student with no parent data', async () => {
      const result = await service.findContactByUsn('1RV21CS001');
      expect(result.parentPhone).toBe('+919876543210');
      expect(result.preferredLanguage).toBe('kn');
      expect(result.consentVoice).toBe(false);
    });

    it('throws NotFoundException for unknown USN', async () => {
      await expect(service.findContactByUsn('UNKNOWN')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addLink()', () => {
    it('creates a new link between parent and student', async () => {
      const link = await service.addLink('p-new', 's-1');
      expect(link.parentId).toBe('p-new');
      expect(link.studentId).toBe('s-1');
      expect(link.isPrimary).toBe(false);
    });

    it('is idempotent — returns same link on second call', async () => {
      const l1 = await service.addLink('p-dup', 's-1');
      const l2 = await service.addLink('p-dup', 's-1');
      expect(l1.id).toBe(l2.id);
    });

    it('newly linked parent can access student via findById', async () => {
      await service.addLink('p-fresh', 's-1');
      const result = await service.findById('s-1', 'p-fresh');
      expect(result.id).toBe('s-1');
    });
  });
});

// ─── DB mode (mocked repositories) ──────────────────────────────────────────

function makeStudentRepo() {
  return {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn().mockImplementation((e: Partial<StudentEntity>) => ({ ...e } as StudentEntity)),
    save: jest.fn().mockImplementation((e: StudentEntity) => Promise.resolve({ ...e, id: 'db-id', createdAt: new Date(), consentVoice: e.consentVoice ?? false, parentPreferredLanguage: e.parentPreferredLanguage ?? 'kn' })),
  };
}
function makeLinkRepo() {
  return {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn().mockImplementation((e: Partial<ParentStudentLinkEntity>) => ({ ...e } as ParentStudentLinkEntity)),
    save: jest.fn().mockImplementation((e: ParentStudentLinkEntity) => Promise.resolve({ ...e, id: 'link-id', linkedAt: new Date(), isPrimary: false })),
  };
}

const STUDENT_ENTITY: StudentEntity = {
  id: 'db-s-1', userId: 'db-u-1', sapId: 'SAP001', usn: '1RV21CS001',
  name: 'DB Student', dob: '2003-01-01', sectionId: 'CS-A', photoUrl: null,
  biometricRef: null, institutionId: 'rvce', homeState: null, parentPhone: '+919876543210',
  parentName: 'DB Parent', consentVoice: true, parentPreferredLanguage: 'kn',
  createdAt: new Date(),
  semester: null, section: null, department: null, preferredLanguage: null,
};

describe('StudentsService — DB mode', () => {
  let service: StudentsService;
  let studentRepo: ReturnType<typeof makeStudentRepo>;
  let linkRepo: ReturnType<typeof makeLinkRepo>;

  beforeEach(async () => {
    studentRepo = makeStudentRepo();
    linkRepo = makeLinkRepo();

    const module = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: getRepositoryToken(StudentEntity), useValue: studentRepo },
        { provide: getRepositoryToken(ParentStudentLinkEntity), useValue: linkRepo },
      ],
    }).compile();

    service = module.get(StudentsService);
    jest.clearAllMocks();
  });

  describe('findById()', () => {
    it('returns student from DB when requester is student', async () => {
      studentRepo.findOne.mockResolvedValue(STUDENT_ENTITY);
      linkRepo.count.mockResolvedValue(0);
      const result = await service.findById('db-s-1', 'db-u-1');
      expect(result.name).toBe('DB Student');
      expect(studentRepo.findOne).toHaveBeenCalledWith({ where: { id: 'db-s-1' } });
    });

    it('allows linked parent access', async () => {
      studentRepo.findOne.mockResolvedValue(STUDENT_ENTITY);
      linkRepo.count.mockResolvedValue(1);
      const result = await service.findById('db-s-1', 'p-linked');
      expect(result.id).toBe('db-s-1');
    });

    it('throws NotFoundException when not in DB', async () => {
      studentRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing', 'u')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for unlinked requester', async () => {
      studentRepo.findOne.mockResolvedValue(STUDENT_ENTITY);
      linkRepo.count.mockResolvedValue(0);
      await expect(service.findById('db-s-1', 'stranger')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create()', () => {
    it('saves entity to DB and returns DTO', async () => {
      const saved = { ...STUDENT_ENTITY, id: 'new-id', usn: '1RV22CS002', name: 'New DB Student' };
      studentRepo.save.mockResolvedValue(saved);
      const result = await service.create({
        userId: 'db-u-2', sapId: 'SAP002', usn: '1RV22CS002', name: 'New DB Student',
        dob: '2004-01-01', sectionId: 'CS-B', institutionId: 'rvce',
      });
      expect(result.name).toBe('New DB Student');
      expect(studentRepo.save).toHaveBeenCalledTimes(1);
    });

    it('converts Date createdAt to ISO string in DTO', async () => {
      studentRepo.save.mockResolvedValue({ ...STUDENT_ENTITY, createdAt: new Date('2025-01-01') });
      const result = await service.create({ userId: 'u', sapId: 'SAP', usn: '1RV', name: 'S', dob: '2000-01-01', sectionId: 'A', institutionId: 'i' });
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toContain('2025-01-01');
    });
  });

  describe('findContactByUsn()', () => {
    it('returns contact from DB', async () => {
      studentRepo.findOne.mockResolvedValue(STUDENT_ENTITY);
      const result = await service.findContactByUsn('1RV21CS001');
      expect(result.parentPhone).toBe('+919876543210');
      expect(result.consentVoice).toBe(true);
    });

    it('throws NotFoundException when student not in DB', async () => {
      studentRepo.findOne.mockResolvedValue(null);
      await expect(service.findContactByUsn('MISSING')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addLink()', () => {
    it('creates link in DB when none exists', async () => {
      linkRepo.findOne.mockResolvedValue(null);
      const saved = { id: 'new-link', parentId: 'p-1', studentId: 'db-s-1', isPrimary: false, linkedAt: new Date() };
      linkRepo.save.mockResolvedValue(saved);
      const result = await service.addLink('p-1', 'db-s-1');
      expect(result.parentId).toBe('p-1');
      expect(linkRepo.save).toHaveBeenCalledTimes(1);
    });

    it('returns existing link without saving when already exists', async () => {
      const existing = { id: 'existing-link', parentId: 'p-1', studentId: 's-1', isPrimary: true, linkedAt: new Date() };
      linkRepo.findOne.mockResolvedValue(existing);
      const result = await service.addLink('p-1', 's-1');
      expect(result.id).toBe('existing-link');
      expect(linkRepo.save).not.toHaveBeenCalled();
    });
  });
});
