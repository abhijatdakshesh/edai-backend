import { Test, TestingModule } from '@nestjs/testing';
import { AdminPortalService } from './admin-portal.service';
import { FeesApiService } from '../fees-api/fees-api.service';

const mockFeesSvc = {
  feeItems: [] as any[],
  getStudentFees: jest.fn(),
};

describe('AdminPortalService', () => {
  let service: AdminPortalService;

  beforeEach(async () => {
    mockFeesSvc.feeItems = [];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminPortalService,
        { provide: FeesApiService, useValue: mockFeesSvc },
      ],
    }).compile();

    service = module.get<AdminPortalService>(AdminPortalService);
  });

  // ─── getDashboard ────────────────────────────────────────────────────────────

  describe('getDashboard()', () => {
    it('returns correct structure with static fields', () => {
      const result = service.getDashboard();
      expect(result.totalStudents).toBe(450);
      expect(result.totalFaculty).toBe(35);
      expect(result.avgAttendance).toBe(82);
      expect(result.alerts).toHaveLength(2);
    });

    it('sums feesCollected from PAID fee items', () => {
      mockFeesSvc.feeItems = [
        { id: 'f1', status: 'PAID', amount: 50000 },
        { id: 'f2', status: 'PENDING', amount: 30000 },
        { id: 'f3', status: 'PAID', amount: 20000 },
      ];
      const result = service.getDashboard();
      expect(result.feesCollected).toBe(70000);
    });

    it('returns zero feesCollected when no PAID items', () => {
      mockFeesSvc.feeItems = [{ id: 'f1', status: 'PENDING', amount: 50000 }];
      const result = service.getDashboard();
      expect(result.feesCollected).toBe(0);
    });

    it('returns zero feesCollected when feeItems is empty', () => {
      mockFeesSvc.feeItems = [];
      expect(service.getDashboard().feesCollected).toBe(0);
    });

    it('includes two alerts with correct severity', () => {
      const { alerts } = service.getDashboard();
      expect(alerts[0].severity).toBe('HIGH');
      expect(alerts[1].severity).toBe('MEDIUM');
    });
  });

  // ─── getReports ──────────────────────────────────────────────────────────────

  describe('getReports()', () => {
    it('returns 3 reports', () => {
      const result = service.getReports();
      expect(result).toHaveLength(3);
    });

    it('includes ATTENDANCE, ACADEMIC, and FEES report types', () => {
      const types = service.getReports().map((r) => r.type);
      expect(types).toContain('ATTENDANCE');
      expect(types).toContain('ACADEMIC');
      expect(types).toContain('FEES');
    });

    it('each report has id, type, label, and data fields', () => {
      service.getReports().forEach((r) => {
        expect(r.id).toBeDefined();
        expect(r.type).toBeDefined();
        expect(r.label).toBeDefined();
        expect(r.data).toBeDefined();
      });
    });
  });

  // ─── getNaac ─────────────────────────────────────────────────────────────────

  describe('getNaac()', () => {
    it('returns NAAC report with overallScore', () => {
      const result = service.getNaac();
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('returns 7 criteria', () => {
      expect(service.getNaac().criteria).toHaveLength(7);
    });

    it('includes strengths and improvements', () => {
      const { strengths, improvements } = service.getNaac();
      expect(strengths.length).toBeGreaterThan(0);
      expect(improvements.length).toBeGreaterThan(0);
    });
  });

  // ─── triggerBulkImport ───────────────────────────────────────────────────────

  describe('triggerBulkImport()', () => {
    it('returns QUEUED status with entityType and fileUrl', () => {
      const result = service.triggerBulkImport('students', 'https://example.com/students.csv');
      expect(result.status).toBe('QUEUED');
      expect(result.entityType).toBe('students');
      expect(result.jobId).toMatch(/^bulk-/);
      expect(result.message).toContain('students');
      expect(result.message).toContain('https://example.com/students.csv');
    });

    it('works for all entity types', () => {
      ['students', 'faculty', 'classes', 'courses'].forEach((type) => {
        const result = service.triggerBulkImport(type, 'https://example.com/file.csv');
        expect(result.entityType).toBe(type);
      });
    });
  });
});
