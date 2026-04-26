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

  // ─── getAttendanceTrend ──────────────────────────────────────────────────────

  describe('getAttendanceTrend()', () => {
    it('returns 6-month trend array with month and pct fields', () => {
      const result = service.getAttendanceTrend();
      expect(result).toHaveLength(6);
      result.forEach((r) => {
        expect(typeof r.month).toBe('string');
        expect(typeof r.pct).toBe('number');
        expect(r.pct).toBeGreaterThanOrEqual(0);
        expect(r.pct).toBeLessThanOrEqual(100);
      });
    });
  });

  // ─── getFeeCollection ────────────────────────────────────────────────────────

  describe('getFeeCollection()', () => {
    it('returns array with collected <= target invariant', () => {
      const result = service.getFeeCollection();
      expect(result.length).toBeGreaterThan(0);
      result.forEach((r) => {
        expect(r.collected).toBeLessThanOrEqual(r.target);
      });
    });
  });

  // ─── getNaacMetrics ──────────────────────────────────────────────────────────

  describe('getNaacMetrics()', () => {
    it('returns grade A and 7 criteria each with trend field', () => {
      const result = service.getNaacMetrics();
      expect(result.grade).toBe('A');
      expect(result.criteria).toHaveLength(7);
      result.criteria.forEach((c) => {
        expect(['UP', 'DOWN', 'STABLE']).toContain(c.trend);
        expect(c.score).toBeLessThanOrEqual(c.maxScore);
      });
    });

    it('overallScore is between 0 and 4 (NAAC 4-point scale)', () => {
      const { overallScore } = service.getNaacMetrics();
      expect(overallScore).toBeGreaterThan(0);
      expect(overallScore).toBeLessThanOrEqual(4);
    });
  });

  // ─── getExportRows ───────────────────────────────────────────────────────────

  describe('getExportRows()', () => {
    it('returns attendance rows for "attendance" type', () => {
      const result = service.getExportRows('attendance');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns fee rows for "fee" type', () => {
      expect(Array.isArray(service.getExportRows('fee'))).toBe(true);
    });

    it('returns placement rows for "placement" type', () => {
      expect(service.getExportRows('placement').length).toBeGreaterThan(0);
    });

    it('returns 7 NAAC criteria for "naac" type', () => {
      expect(service.getExportRows('naac')).toHaveLength(7);
    });

    it('returns grievance records for "grievance" type', () => {
      expect(service.getExportRows('grievance')).toHaveLength(2);
    });

    it('returns mark distribution for "mark" type with range and count', () => {
      const result = service.getExportRows('mark');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('range');
      expect(result[0]).toHaveProperty('count');
    });

    it('falls through to dashboard summary for unknown type', () => {
      const result = service.getExportRows('unknown-type');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('totalStudents');
    });
  });

  // ─── getPlacementPredictions ─────────────────────────────────────────────────

  describe('getPlacementPredictions() — likelihood filter', () => {
    it('returns empty array for VERY_LOW likelihood (no seed data matches)', () => {
      expect(service.getPlacementPredictions(undefined, 'VERY_LOW')).toHaveLength(0);
    });

    it('filters by dept when provided', () => {
      const result = service.getPlacementPredictions('ECE');
      result.forEach((r) => expect(r.dept).toBe('ECE'));
    });
  });

  // ─── getClassPerformance ─────────────────────────────────────────────────────

  describe('getClassPerformance()', () => {
    it('returns avgCgpa, topCgpa, passRate with valid ranges', () => {
      const result = service.getClassPerformance();
      expect(typeof result.avgCgpa).toBe('number');
      expect(result.topCgpa).toBeGreaterThanOrEqual(result.avgCgpa);
      expect(result.passRate).toBeLessThanOrEqual(100);
      expect(result.passRate).toBeGreaterThan(0);
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

  describe('exportAnalytics()', () => {
    it('returns url, filename, generatedAt for named type', () => {
      const result = service.exportAnalytics('attendance');
      expect(result.url).toContain('attendance');
      expect(result.filename).toContain('attendance');
      expect(result.generatedAt).toBeDefined();
    });

    it('defaults label to "all" when type is undefined', () => {
      const result = service.exportAnalytics(undefined);
      expect(result.filename).toContain('all');
    });
  });

  describe('computeNaacGrade() — full rubric boundary tests', () => {
    it('A++ at 3.51', () => expect(AdminPortalService.computeNaacGrade(3.51)).toBe('A++'));
    it('A+ at 3.26', () => expect(AdminPortalService.computeNaacGrade(3.26)).toBe('A+'));
    it('A at 3.01', () => expect(AdminPortalService.computeNaacGrade(3.01)).toBe('A'));
    it('B++ at 2.76', () => expect(AdminPortalService.computeNaacGrade(2.76)).toBe('B++'));
    it('B+ at 2.51', () => expect(AdminPortalService.computeNaacGrade(2.51)).toBe('B+'));
    it('B at 2.01', () => expect(AdminPortalService.computeNaacGrade(2.01)).toBe('B'));
    it('C at 1.51', () => expect(AdminPortalService.computeNaacGrade(1.51)).toBe('C'));
    it('D below 1.51', () => expect(AdminPortalService.computeNaacGrade(1.0)).toBe('D'));
  });
});
