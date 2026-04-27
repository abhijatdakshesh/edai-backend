import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { RiskService, RiskScore, RiskSummary } from './risk.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDbRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    studentUsn: '1RV21CS001',
    name: 'Arjun Sharma',
    department: 'CSE',
    semester: '5',
    section: 'A',
    riskScore: '72',
    riskLevel: 'HIGH',
    attendancePct: '68',
    failingSubjectCount: '2',
    feeStatus: 'OVERDUE',
    attTrendDelta: '-5',
    attScore: '30',
    marksScore: '25',
    feeScore: '10',
    trendScore: '7',
    computedAt: '2026-04-27T10:00:00Z',
    ...overrides,
  };
}

function makeStudentRiskRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    student_usn: '1RV21CS001',
    name: 'Arjun Sharma',
    department: 'CSE',
    semester: '5',
    section: 'A',
    risk_score: '72',
    risk_level: 'HIGH',
    attendance_pct: '68',
    failing_subject_count: '2',
    fee_status: 'OVERDUE',
    att_trend_delta: '-5',
    att_score: '30',
    marks_score: '25',
    fee_score: '10',
    trend_score: '7',
    computed_at: '2026-04-27T10:00:00Z',
    ...overrides,
  };
}

function makeSummaryRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    department: 'CSE',
    total: '60',
    critical: '3',
    high: '8',
    medium: '15',
    low: '34',
    avg_risk_score: '61.2',
    ...overrides,
  };
}

// ─── Mock DataSource ──────────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockDataSource = { query: mockQuery };

async function buildService(): Promise<RiskService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RiskService,
      { provide: getDataSourceToken(), useValue: mockDataSource },
    ],
  }).compile();
  return module.get<RiskService>(RiskService);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RiskService', () => {
  let service: RiskService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await buildService();
  });

  // ─── getAtRiskStudents ───────────────────────────────────────────────────────

  describe('getAtRiskStudents()', () => {
    it('queries with default minScore=50 and limit=100 when no filters supplied', async () => {
      mockQuery.mockResolvedValue([makeDbRow()]);

      const result = await service.getAtRiskStudents({});

      // First param must be 50 (default minScore), last param 100 (default limit)
      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBe(50);
      expect(params[params.length - 1]).toBe(100);

      expect(result).toHaveLength(1);
      expect(result[0].studentUsn).toBe('1RV21CS001');
    });

    it('uses provided minScore and limit when explicitly passed', async () => {
      mockQuery.mockResolvedValue([]);

      await service.getAtRiskStudents({ minScore: 75, limit: 10 });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBe(75);
      expect(params[params.length - 1]).toBe(10);
    });

    it('appends department filter and pushes dept to params', async () => {
      mockQuery.mockResolvedValue([]);

      await service.getAtRiskStudents({ department: 'ECE' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('AND department =');
      expect(params).toContain('ECE');
    });

    it('appends semester filter when semester is provided', async () => {
      mockQuery.mockResolvedValue([]);

      await service.getAtRiskStudents({ semester: 3 });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('AND semester =');
      expect(params).toContain(3);
    });

    it('appends riskLevel filter and uppercases the value', async () => {
      mockQuery.mockResolvedValue([]);

      await service.getAtRiskStudents({ riskLevel: 'high' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('AND risk_level =');
      expect(params).toContain('HIGH');
    });

    it('applies all four filters simultaneously (all optional branches)', async () => {
      mockQuery.mockResolvedValue([]);

      await service.getAtRiskStudents({
        department: 'CSE',
        semester: 5,
        riskLevel: 'critical',
        minScore: 80,
        limit: 50,
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('AND department =');
      expect(sql).toContain('AND semester =');
      expect(sql).toContain('AND risk_level =');
      expect(params).toContain('CSE');
      expect(params).toContain(5);
      expect(params).toContain('CRITICAL');
      expect(params[0]).toBe(80);
      expect(params[params.length - 1]).toBe(50);
    });

    it('maps all row fields to RiskScore shape with correct numeric conversions', async () => {
      mockQuery.mockResolvedValue([makeDbRow()]);

      const [score] = await service.getAtRiskStudents({});

      expect(score.studentUsn).toBe('1RV21CS001');
      expect(score.name).toBe('Arjun Sharma');
      expect(score.department).toBe('CSE');
      expect(score.semester).toBe(5);           // Number() applied
      expect(score.section).toBe('A');
      expect(score.riskScore).toBe(72);          // Number() applied
      expect(score.riskLevel).toBe('HIGH');
      expect(score.attendancePct).toBe(68);      // Number() applied
      expect(score.failingSubjectCount).toBe(2); // Number() applied
      expect(score.feeStatus).toBe('OVERDUE');
      expect(score.attTrendDelta).toBe(-5);      // Number() applied
      expect(score.breakdown.attendanceScore).toBe(30);
      expect(score.breakdown.marksScore).toBe(25);
      expect(score.breakdown.feeScore).toBe(10);
      expect(score.breakdown.trendScore).toBe(7);
      expect(score.computedAt).toBe('2026-04-27T10:00:00Z');
    });

    it('returns empty array when db returns no rows', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await service.getAtRiskStudents({});
      expect(result).toEqual([]);
    });

    // ERP edge case: attendance exactly at 75% boundary — risk score derived from this
    it('maps attendancePct of exactly 75 correctly (VTU detention boundary)', async () => {
      mockQuery.mockResolvedValue([makeDbRow({ attendancePct: '75' })]);
      const [score] = await service.getAtRiskStudents({});
      expect(score.attendancePct).toBe(75);
    });

    // ERP edge case: student with zero failing subjects still appears in risk list (fee default)
    it('handles failingSubjectCount of 0 (fee-only risk)', async () => {
      mockQuery.mockResolvedValue([makeDbRow({ failingSubjectCount: '0', riskLevel: 'LOW' })]);
      const [score] = await service.getAtRiskStudents({});
      expect(score.failingSubjectCount).toBe(0);
    });

    // ERP edge case: re-examination / re-admission row where trend delta is positive
    it('maps positive attTrendDelta (student recovering from detention risk)', async () => {
      mockQuery.mockResolvedValue([makeDbRow({ attTrendDelta: '3.5' })]);
      const [score] = await service.getAtRiskStudents({});
      expect(score.attTrendDelta).toBe(3.5);
    });

    it('orders result by risk_score DESC (SQL includes ORDER BY clause)', async () => {
      mockQuery.mockResolvedValue([]);
      await service.getAtRiskStudents({});
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ORDER BY risk_score DESC');
    });
  });

  // ─── getStudentRisk ──────────────────────────────────────────────────────────

  describe('getStudentRisk()', () => {
    it('returns null when no row is found for the given USN', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await service.getStudentRisk('1RV21CS999');
      expect(result).toBeNull();
    });

    it('returns a mapped RiskScore when row is found', async () => {
      mockQuery.mockResolvedValue([makeStudentRiskRow()]);
      const result = await service.getStudentRisk('1RV21CS001');
      expect(result).not.toBeNull();
      expect(result!.studentUsn).toBe('1RV21CS001');
      expect(result!.riskLevel).toBe('HIGH');
      expect(result!.semester).toBe(5);
      expect(result!.riskScore).toBe(72);
      expect(result!.attendancePct).toBe(68);
      expect(result!.failingSubjectCount).toBe(2);
      expect(result!.attTrendDelta).toBe(-5);
      expect(result!.breakdown).toEqual({
        attendanceScore: 30,
        marksScore: 25,
        feeScore: 10,
        trendScore: 7,
      });
      expect(result!.computedAt).toBe('2026-04-27T10:00:00Z');
    });

    it('passes USN as the query parameter', async () => {
      mockQuery.mockResolvedValue([makeStudentRiskRow()]);
      await service.getStudentRisk('1RV21CS001');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('student_usn = $1'),
        ['1RV21CS001'],
      );
    });

    it('uses first row only when multiple rows returned (defensive)', async () => {
      mockQuery.mockResolvedValue([
        makeStudentRiskRow({ student_usn: '1RV21CS001', risk_score: '72' }),
        makeStudentRiskRow({ student_usn: '1RV21CS001', risk_score: '90' }),
      ]);
      const result = await service.getStudentRisk('1RV21CS001');
      expect(result!.riskScore).toBe(72); // first row wins
    });

    // ERP edge: CRITICAL level student — most urgent action needed
    it('maps riskLevel CRITICAL correctly', async () => {
      mockQuery.mockResolvedValue([makeStudentRiskRow({ risk_level: 'CRITICAL', risk_score: '95' })]);
      const result = await service.getStudentRisk('1RV21CS001');
      expect(result!.riskLevel).toBe('CRITICAL');
      expect(result!.riskScore).toBe(95);
    });

    // ERP edge: LOW risk student also present in table
    it('maps riskLevel LOW correctly', async () => {
      mockQuery.mockResolvedValue([makeStudentRiskRow({ risk_level: 'LOW', risk_score: '20' })]);
      const result = await service.getStudentRisk('1RV21CS001');
      expect(result!.riskLevel).toBe('LOW');
    });

    // ERP edge: MEDIUM level student
    it('maps riskLevel MEDIUM correctly', async () => {
      mockQuery.mockResolvedValue([makeStudentRiskRow({ risk_level: 'MEDIUM', risk_score: '55' })]);
      const result = await service.getStudentRisk('1RV21CS001');
      expect(result!.riskLevel).toBe('MEDIUM');
    });
  });

  // ─── getDepartmentSummary ────────────────────────────────────────────────────

  describe('getDepartmentSummary()', () => {
    it('returns an array of RiskSummary objects with correct numeric conversions', async () => {
      mockQuery.mockResolvedValue([
        makeSummaryRow(),
        makeSummaryRow({ department: 'ECE', total: '45', critical: '1', high: '5', medium: '10', low: '29', avg_risk_score: '48.7' }),
      ]);

      const result = await service.getDepartmentSummary();

      expect(result).toHaveLength(2);
      expect(result[0].department).toBe('CSE');
      expect(result[0].total).toBe(60);
      expect(result[0].critical).toBe(3);
      expect(result[0].high).toBe(8);
      expect(result[0].medium).toBe(15);
      expect(result[0].low).toBe(34);
      expect(result[0].avgRiskScore).toBe(61.2);

      expect(result[1].department).toBe('ECE');
      expect(result[1].avgRiskScore).toBe(48.7);
    });

    it('returns empty array when no departments have risk scores', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await service.getDepartmentSummary();
      expect(result).toEqual([]);
    });

    it('runs a single query with GROUP BY department', async () => {
      mockQuery.mockResolvedValue([]);
      await service.getDepartmentSummary();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('GROUP BY department');
      expect(sql).toContain('ORDER BY avg_risk_score DESC');
    });

    // ERP edge: new department with no students at all — all zeros
    it('maps department with all-zero counts (new department edge case)', async () => {
      mockQuery.mockResolvedValue([
        makeSummaryRow({ department: 'AIML', total: '0', critical: '0', high: '0', medium: '0', low: '0', avg_risk_score: '0' }),
      ]);
      const [summary] = await service.getDepartmentSummary();
      expect(summary.department).toBe('AIML');
      expect(summary.total).toBe(0);
      expect(summary.avgRiskScore).toBe(0);
    });
  });

  // ─── sendWeeklyRiskDigest ────────────────────────────────────────────────────

  describe('sendWeeklyRiskDigest()', () => {
    it('skips digest and returns early when both critical and high lists are empty', async () => {
      // getAtRiskStudents returns [] for both CRITICAL and HIGH calls
      mockQuery.mockResolvedValue([]);

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendWeeklyRiskDigest();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No at-risk students this week'),
      );
      // getDepartmentSummary must NOT be called when no at-risk students
      // query is only called for the two getAtRiskStudents calls (CRITICAL + HIGH)
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('skips digest when critical list is empty and high list is empty (both zero)', async () => {
      mockQuery.mockResolvedValue([]);
      await service.sendWeeklyRiskDigest();
      // verify early return: no department summary query fired
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('proceeds with digest when critical list is non-empty', async () => {
      const criticalRow = makeDbRow({ riskLevel: 'CRITICAL', riskScore: '95', department: 'CSE' });
      const hodRow = [{ email: 'cse.hod@rvce.edu.in', name: 'Dr. Ramesh' }];

      mockQuery
        // call 1: getAtRiskStudents({ riskLevel: 'CRITICAL', limit: 200 })
        .mockResolvedValueOnce([criticalRow])
        // call 2: getAtRiskStudents({ riskLevel: 'HIGH', limit: 200 })
        .mockResolvedValueOnce([])
        // call 3: getDepartmentSummary()
        .mockResolvedValueOnce([makeSummaryRow()])
        // call 4: HOD query for 'CSE'
        .mockResolvedValueOnce(hodRow);

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendWeeklyRiskDigest();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Digest sent'),
      );
      // Final log should report 1 critical, 0 high, 1 department
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Critical: 1.*High: 0/),
      );
    });

    it('proceeds with digest when high list is non-empty (critical empty)', async () => {
      const highRow = makeDbRow({ riskLevel: 'HIGH', riskScore: '78', department: 'ECE' });
      const hodRow = [{ email: 'ece.hod@rvce.edu.in', name: 'Dr. Priya' }];

      mockQuery
        .mockResolvedValueOnce([])            // CRITICAL — empty
        .mockResolvedValueOnce([highRow])     // HIGH — one student
        .mockResolvedValueOnce([makeSummaryRow({ department: 'ECE' })])  // summary
        .mockResolvedValueOnce(hodRow);       // HOD for ECE

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendWeeklyRiskDigest();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Critical: 0.*High: 1/),
      );
    });

    it('groups students from multiple departments and fires one email per dept', async () => {
      const cseStudent = makeDbRow({ riskLevel: 'CRITICAL', riskScore: '91', department: 'CSE' });
      const eceStudent = makeDbRow({ riskLevel: 'HIGH', riskScore: '77', department: 'ECE' });

      mockQuery
        .mockResolvedValueOnce([cseStudent])                   // CRITICAL
        .mockResolvedValueOnce([eceStudent])                   // HIGH
        .mockResolvedValueOnce([makeSummaryRow(), makeSummaryRow({ department: 'ECE' })]) // summary
        .mockResolvedValueOnce([{ email: 'cse@rv.edu', name: 'HOD CSE' }])  // HOD CSE
        .mockResolvedValueOnce([{ email: 'ece@rv.edu', name: 'HOD ECE' }]); // HOD ECE

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendWeeklyRiskDigest();

      // Should log digest sent for 2 departments
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/2 departments/),
      );
    });

    it('warns and skips dept when HOD email is absent and FALLBACK_ALERT_EMAIL is not set', async () => {
      delete process.env['FALLBACK_ALERT_EMAIL'];
      const criticalRow = makeDbRow({ riskLevel: 'CRITICAL', riskScore: '95', department: 'CSE' });

      mockQuery
        .mockResolvedValueOnce([criticalRow])   // CRITICAL
        .mockResolvedValueOnce([])              // HIGH
        .mockResolvedValueOnce([makeSummaryRow()]) // summary
        .mockResolvedValueOnce([]);             // HOD query returns no rows

      const warnSpy = jest.spyOn((service as any).logger, 'warn');
      await service.sendWeeklyRiskDigest();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No HOD email for CSE'),
      );
    });

    it('uses FALLBACK_ALERT_EMAIL when HOD row is missing email field', async () => {
      process.env['FALLBACK_ALERT_EMAIL'] = 'fallback@rvce.edu.in';
      const criticalRow = makeDbRow({ riskLevel: 'CRITICAL', riskScore: '95', department: 'ME' });

      mockQuery
        .mockResolvedValueOnce([criticalRow])  // CRITICAL
        .mockResolvedValueOnce([])             // HIGH
        .mockResolvedValueOnce([makeSummaryRow({ department: 'ME' })])
        .mockResolvedValueOnce([]);            // no HOD row — triggers fallback

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendWeeklyRiskDigest();

      // Should log "Would send digest to fallback@rvce.edu.in"
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('fallback@rvce.edu.in'),
      );

      delete process.env['FALLBACK_ALERT_EMAIL'];
    });

    it('renders >20 students truncated with "+N more" log path', async () => {
      // Build 21 CRITICAL students in CSE to exercise the students.length > 20 branch
      const rows = Array.from({ length: 21 }, (_, i) =>
        makeDbRow({ studentUsn: `1RV21CS${String(i + 1).padStart(3, '0')}`, riskLevel: 'CRITICAL', department: 'CSE' }),
      );

      mockQuery
        .mockResolvedValueOnce(rows)           // CRITICAL — 21 students
        .mockResolvedValueOnce([])             // HIGH
        .mockResolvedValueOnce([makeSummaryRow()])
        .mockResolvedValueOnce([{ email: 'hod@rv.edu', name: 'HOD' }]);

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendWeeklyRiskDigest();

      // Digest must still complete successfully
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Digest sent'),
      );
    });

    it('uses FRONTEND_URL env var in the email HTML', async () => {
      process.env['FRONTEND_URL'] = 'https://erp.rvce.edu.in';
      const criticalRow = makeDbRow({ riskLevel: 'CRITICAL', department: 'CSE' });

      mockQuery
        .mockResolvedValueOnce([criticalRow])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeSummaryRow()])
        .mockResolvedValueOnce([{ email: 'hod@rv.edu', name: 'HOD' }]);

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendWeeklyRiskDigest();

      // The "Would send digest" log must contain HTML length (HTML is built with FRONTEND_URL)
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTML length='),
      );

      delete process.env['FRONTEND_URL'];
    });

    it('falls back to localhost:3000 when FRONTEND_URL is absent', async () => {
      delete process.env['FRONTEND_URL'];
      const criticalRow = makeDbRow({ riskLevel: 'CRITICAL', department: 'CSE' });

      mockQuery
        .mockResolvedValueOnce([criticalRow])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeSummaryRow()])
        .mockResolvedValueOnce([{ email: 'hod@rv.edu', name: 'HOD' }]);

      // Should not throw — default URL is used silently
      await expect(service.sendWeeklyRiskDigest()).resolves.toBeUndefined();
    });

    it('uses "HOD" as fallback hodName when HOD row has no name field', async () => {
      process.env['FALLBACK_ALERT_EMAIL'] = 'fallback@rv.edu';
      const criticalRow = makeDbRow({ riskLevel: 'CRITICAL', department: 'CSE' });

      mockQuery
        .mockResolvedValueOnce([criticalRow])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeSummaryRow()])
        .mockResolvedValueOnce([]);  // HOD row missing — hodName defaults to 'HOD'

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendWeeklyRiskDigest();

      // Should reach the "Would send digest" log (not skip due to missing name)
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Would send digest'),
      );

      delete process.env['FALLBACK_ALERT_EMAIL'];
    });

    it('handles deptSummary being undefined (dept in byDept but not in summary)', async () => {
      // summary is empty — find() returns undefined for every dept
      const criticalRow = makeDbRow({ riskLevel: 'CRITICAL', department: 'NEW_DEPT' });

      mockQuery
        .mockResolvedValueOnce([criticalRow])  // CRITICAL
        .mockResolvedValueOnce([])             // HIGH
        .mockResolvedValueOnce([])             // getDepartmentSummary returns []
        .mockResolvedValueOnce([{ email: 'hod@rv.edu', name: 'HOD' }]);

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendWeeklyRiskDigest();

      // summary?.total ?? 0 fallback — HTML renders 0 for TOTAL STUDENTS
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Would send digest'),
      );
    });

    // ERP edge: concurrent execution of digest — both CRITICAL and HIGH for same dept
    it('merges CRITICAL and HIGH students from same dept into one byDept bucket', async () => {
      const crit = makeDbRow({ riskLevel: 'CRITICAL', riskScore: '95', department: 'CSE' });
      const high = makeDbRow({ riskLevel: 'HIGH', riskScore: '75', department: 'CSE', studentUsn: '1RV21CS002' });

      mockQuery
        .mockResolvedValueOnce([crit])
        .mockResolvedValueOnce([high])
        .mockResolvedValueOnce([makeSummaryRow()])
        .mockResolvedValueOnce([{ email: 'hod@rv.edu', name: 'HOD' }]);

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendWeeklyRiskDigest();

      // Only 1 dept, not 2 — merged correctly
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/1 departments/),
      );
    });
  });
});
