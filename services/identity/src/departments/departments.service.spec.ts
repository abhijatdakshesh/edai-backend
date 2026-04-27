import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DepartmentsService, Department } from './departments.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DepartmentsService],
    }).compile();
    service = module.get<DepartmentsService>(DepartmentsService);
  });

  describe('findAll()', () => {
    it('returns only active departments', () => {
      const result = service.findAll();
      expect(result.every((d) => d.active)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('findByCode()', () => {
    it('returns department by code', () => {
      const dept = service.findByCode('CSE');
      expect(dept.code).toBe('CSE');
    });

    it('throws NotFoundException for unknown code', () => {
      expect(() => service.findByCode('UNKNOWN')).toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('creates a department and returns it with active:true', () => {
      const payload: Omit<Department, 'active' | 'createdAt'> = {
        code: 'BIO', name: 'Biotechnology', hodUserId: 'u-hod-10', established: 2010,
      };
      const result = service.create(payload);
      expect(result.code).toBe('BIO');
      expect(result.active).toBe(true);
      expect(result.createdAt).toBeDefined();
    });

    it('new department appears in findAll()', () => {
      service.create({ code: 'ARCH', name: 'Architecture', hodUserId: 'u-hod-11', established: 2005 });
      const all = service.findAll();
      expect(all.some((d) => d.code === 'ARCH')).toBe(true);
    });
  });

  describe('update()', () => {
    it('updates a department by code', () => {
      const result = service.update('CSE', { name: 'CS & AI' });
      expect(result.name).toBe('CS & AI');
    });

    it('throws NotFoundException for unknown code', () => {
      expect(() => service.update('UNKNOWN', { name: 'X' })).toThrow(NotFoundException);
    });
  });
});
