import { Test, TestingModule } from '@nestjs/testing';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRiskScore(overrides = {}) {
  return {
    studentUsn: '1RV21CS001',
    name: 'Arjun Sharma',
    department: 'CSE',
    semester: 5,
    section: 'A',
    riskScore: 72,
    riskLevel: 'HIGH' as const,
    attendancePct: 68,
    failingSubjectCount: 2,
    feeStatus: 'OVERDUE',
    attTrendDelta: -5,
    breakdown: { attendanceScore: 30, marksScore: 25, feeScore: 10, trendScore: 7 },
    computedAt: '2026-04-27T10:00:00Z',
    ...overrides,
  };
}

function makeRiskSummary(overrides = {}) {
  return {
    department: 'CSE',
    total: 60,
    critical: 3,
    high: 8,
    medium: 15,
    low: 34,
    avgRiskScore: 61.2,
    ...overrides,
  };
}

// ─── Mock Service ─────────────────────────────────────────────────────────────

const mockSvc = {
  getAtRiskStudents: jest.fn(),
  getStudentRisk: jest.fn(),
  getDepartmentSummary: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RiskController', () => {
  let controller: RiskController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RiskController],
      providers: [{ provide: RiskService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RiskController>(RiskController);
  });

  // ─── GET /risk/students ──────────────────────────────────────────────────────

  describe('getAtRiskStudents()', () => {
    it('delegates to service with defaults when all query params are absent', () => {
      mockSvc.getAtRiskStudents.mockResolvedValue([makeRiskScore()]);

      controller.getAtRiskStudents(
        undefined, undefined, undefined, undefined, undefined,
      );

      expect(mockSvc.getAtRiskStudents).toHaveBeenCalledWith({
        department: undefined,
        semester: undefined,
        riskLevel: undefined,
        minScore: 50,   // default
        limit: 100,     // default
      });
    });

    it('parses semester as integer from query string', () => {
      mockSvc.getAtRiskStudents.mockResolvedValue([]);

      controller.getAtRiskStudents(undefined, '3', undefined, undefined, undefined);

      expect(mockSvc.getAtRiskStudents).toHaveBeenCalledWith(
        expect.objectContaining({ semester: 3 }),
      );
    });

    it('parses minScore as integer from query string', () => {
      mockSvc.getAtRiskStudents.mockResolvedValue([]);

      controller.getAtRiskStudents(undefined, undefined, undefined, '75', undefined);

      expect(mockSvc.getAtRiskStudents).toHaveBeenCalledWith(
        expect.objectContaining({ minScore: 75 }),
      );
    });

    it('parses limit as integer from query string', () => {
      mockSvc.getAtRiskStudents.mockResolvedValue([]);

      controller.getAtRiskStudents(undefined, undefined, undefined, undefined, '25');

      expect(mockSvc.getAtRiskStudents).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25 }),
      );
    });

    it('passes department and riskLevel through as-is (strings, not parsed)', () => {
      mockSvc.getAtRiskStudents.mockResolvedValue([]);

      controller.getAtRiskStudents('ECE', undefined, 'CRITICAL', undefined, undefined);

      expect(mockSvc.getAtRiskStudents).toHaveBeenCalledWith(
        expect.objectContaining({ department: 'ECE', riskLevel: 'CRITICAL' }),
      );
    });

    it('uses minScore default of 50 when minScore param is absent (undefined)', () => {
      mockSvc.getAtRiskStudents.mockResolvedValue([]);

      controller.getAtRiskStudents(undefined, undefined, undefined, undefined, undefined);

      const call = mockSvc.getAtRiskStudents.mock.calls[0][0];
      expect(call.minScore).toBe(50);
    });

    it('uses limit default of 100 when limit param is absent (undefined)', () => {
      mockSvc.getAtRiskStudents.mockResolvedValue([]);

      controller.getAtRiskStudents(undefined, undefined, undefined, undefined, undefined);

      const call = mockSvc.getAtRiskStudents.mock.calls[0][0];
      expect(call.limit).toBe(100);
    });

    it('all five params provided — all passed through correctly', () => {
      mockSvc.getAtRiskStudents.mockResolvedValue([makeRiskScore()]);

      controller.getAtRiskStudents('CSE', '5', 'HIGH', '60', '50');

      expect(mockSvc.getAtRiskStudents).toHaveBeenCalledWith({
        department: 'CSE',
        semester: 5,
        riskLevel: 'HIGH',
        minScore: 60,
        limit: 50,
      });
    });

    it('returns the service result directly', () => {
      const expected = [makeRiskScore()];
      mockSvc.getAtRiskStudents.mockResolvedValue(expected);

      const result = controller.getAtRiskStudents(
        undefined, undefined, undefined, undefined, undefined,
      );

      // controller returns the promise from service — same reference
      expect(result).toBe(mockSvc.getAtRiskStudents.mock.results[0].value);
    });

    // ERP edge: semester '0' — parseInt produces 0, which is falsy — passes as 0 not undefined
    it('parses semester "0" as integer 0 (falsy but defined)', () => {
      mockSvc.getAtRiskStudents.mockResolvedValue([]);

      controller.getAtRiskStudents(undefined, '0', undefined, undefined, undefined);

      expect(mockSvc.getAtRiskStudents).toHaveBeenCalledWith(
        expect.objectContaining({ semester: 0 }),
      );
    });

    // ERP edge: minScore=0 means include all students (edge admission case)
    it('parses minScore "0" correctly — all students included', () => {
      mockSvc.getAtRiskStudents.mockResolvedValue([]);

      controller.getAtRiskStudents(undefined, undefined, undefined, '0', undefined);

      expect(mockSvc.getAtRiskStudents).toHaveBeenCalledWith(
        expect.objectContaining({ minScore: 0 }),
      );
    });
  });

  // ─── GET /risk/summary ───────────────────────────────────────────────────────

  describe('getDepartmentSummary()', () => {
    it('delegates to service and returns its result', () => {
      const expected = [makeRiskSummary(), makeRiskSummary({ department: 'ECE' })];
      mockSvc.getDepartmentSummary.mockResolvedValue(expected);

      const result = controller.getDepartmentSummary();

      expect(mockSvc.getDepartmentSummary).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockSvc.getDepartmentSummary.mock.results[0].value);
    });

    it('returns empty array when service returns no summaries', () => {
      mockSvc.getDepartmentSummary.mockResolvedValue([]);
      controller.getDepartmentSummary();
      expect(mockSvc.getDepartmentSummary).toHaveBeenCalledTimes(1);
    });

    it('takes no arguments — no query params, no path params', () => {
      mockSvc.getDepartmentSummary.mockResolvedValue([]);

      // Verify the method signature accepts zero args
      expect(() => controller.getDepartmentSummary()).not.toThrow();
      expect(mockSvc.getDepartmentSummary).toHaveBeenCalledWith();
    });
  });

  // ─── GET /risk/students/:usn ─────────────────────────────────────────────────

  describe('getStudentRisk()', () => {
    it('passes the USN param to service', () => {
      const expected = makeRiskScore();
      mockSvc.getStudentRisk.mockResolvedValue(expected);

      controller.getStudentRisk('1RV21CS001');

      expect(mockSvc.getStudentRisk).toHaveBeenCalledWith('1RV21CS001');
    });

    it('returns null when service returns null (student not found)', () => {
      mockSvc.getStudentRisk.mockResolvedValue(null);

      const result = controller.getStudentRisk('1RV21CS999');

      expect(result).toBe(mockSvc.getStudentRisk.mock.results[0].value);
    });

    it('returns the full RiskScore object from service', () => {
      const score = makeRiskScore({ riskLevel: 'CRITICAL', riskScore: 95 });
      mockSvc.getStudentRisk.mockResolvedValue(score);

      const result = controller.getStudentRisk('1RV21CS001');

      expect(result).toBe(mockSvc.getStudentRisk.mock.results[0].value);
    });

    // ERP edge: USN with uppercase — controller does NOT transform USN, service owns that logic
    it('passes USN in its raw form without transformation', () => {
      mockSvc.getStudentRisk.mockResolvedValue(null);

      controller.getStudentRisk('1RV21CS001');

      expect(mockSvc.getStudentRisk).toHaveBeenCalledWith('1RV21CS001');
    });

    // ERP edge: VTU re-admission USN format (lateral entry — starts at semester 3)
    it('handles lateral entry USN format (e.g. 1RV22CS501)', () => {
      mockSvc.getStudentRisk.mockResolvedValue(makeRiskScore({ studentUsn: '1RV22CS501', semester: 3 }));

      controller.getStudentRisk('1RV22CS501');

      expect(mockSvc.getStudentRisk).toHaveBeenCalledWith('1RV22CS501');
    });
  });
});
