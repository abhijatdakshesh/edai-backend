import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { PlacementScoreService } from './placement-score.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScoreRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    usn: '1RV21CS001',
    name: 'Alice Sharma',
    department: 'CSE',
    semester: 8,
    section: 'A',
    cgpa: '8.5',
    attendance_pct: '85',
    backlogs: '0',
    readiness_score: '78',
    placement_status: 'PLACEMENT_READY',
    ...overrides,
  };
}

function makeSubjectRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    subject_name: 'Operating Systems',
    ia1: '18',
    ia2: '19',
    ia3: null,
    max: '20',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock DataSource factory
// ---------------------------------------------------------------------------

function buildMockDataSource(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn();
  return { query };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PlacementScoreService', () => {
  let service: PlacementScoreService;
  let mockQuery: jest.Mock;

  async function buildModule(queryImpl: jest.Mock) {
    mockQuery = queryImpl;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacementScoreService,
        {
          provide: getDataSourceToken(),
          useValue: buildMockDataSource(queryImpl),
        },
      ],
    }).compile();
    service = module.get<PlacementScoreService>(PlacementScoreService);
  }

  beforeEach(() => jest.clearAllMocks());

  // ── getStudentProfile ──────────────────────────────────────────────────────

  describe('getStudentProfile()', () => {
    it('returns full profile for a known USN', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])           // score query
        .mockResolvedValueOnce([makeSubjectRow()]);        // subjects query
      await buildModule(query);

      const profile = await service.getStudentProfile('1RV21CS001');

      expect(profile.usn).toBe('1RV21CS001');
      expect(profile.name).toBe('Alice Sharma');
      expect(profile.department).toBe('CSE');
      expect(profile.semester).toBe(8);
      expect(profile.cgpa).toBe(8.5);
      expect(profile.attendancePct).toBe(85);
      expect(profile.backlogs).toBe(0);
      expect(profile.readinessScore).toBe(78);
      expect(profile.placementStatus).toBe('PLACEMENT_READY');
    });

    it('throws when student USN does not exist (404 path)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([])   // empty score result
        .mockResolvedValueOnce([]);  // subjects (won't be reached but parallel Promise.all)
      await buildModule(query);

      await expect(service.getStudentProfile('UNKNOWN_USN')).rejects.toThrow(
        'Student UNKNOWN_USN not found',
      );
    });

    // ── CGPA score boundary conditions ───────────────────────────────────────

    it('awards 35 CGPA points when cgpa >= 9', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ cgpa: '9.2' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.cgpaPts).toBe(35);
    });

    it('awards 28 CGPA points when cgpa >= 8 and < 9 (boundary 8.0)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ cgpa: '8.0' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.cgpaPts).toBe(28);
    });

    it('awards 20 CGPA points when cgpa >= 7 and < 8 (boundary 7.0)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ cgpa: '7.0' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.cgpaPts).toBe(20);
    });

    it('awards 12 CGPA points when cgpa >= 6 and < 7 (boundary 6.0)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ cgpa: '6.0' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.cgpaPts).toBe(12);
    });

    it('awards 5 CGPA points when cgpa < 6 (high-risk student)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ cgpa: '5.9' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.cgpaPts).toBe(5);
    });

    // ── Attendance score boundary conditions ─────────────────────────────────

    it('awards 25 attendance points when attendance >= 90%', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ attendance_pct: '90' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.attendancePts).toBe(25);
    });

    it('awards 18 attendance points when attendance >= 80% and < 90% (boundary 80.0)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ attendance_pct: '80' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.attendancePts).toBe(18);
    });

    it('awards 10 attendance points at exactly 75% (VTU detention boundary)', async () => {
      // 75% is the VTU minimum — student is eligible but borderline
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ attendance_pct: '75' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.attendancePts).toBe(10);
    });

    it('awards 3 attendance points when attendance < 75% (detained risk)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ attendance_pct: '74' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.attendancePts).toBe(3);
    });

    // ── Backlog score conditions ──────────────────────────────────────────────

    it('awards 20 backlog points when backlogs = 0 (clean sheet)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ backlogs: '0' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.backlogPts).toBe(20);
    });

    it('awards 12 backlog points for 1 backlog (20 - 8)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ backlogs: '1' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.backlogPts).toBe(12);
    });

    it('clamps backlog points to 0 minimum when backlogs >= 3 (does not go negative)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ backlogs: '5' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      // 20 - (5 * 8) = -20, clamped to 0
      expect(profile.scoreBreakdown.backlogPts).toBe(0);
    });

    // ── Semester points ───────────────────────────────────────────────────────

    it('awards 10 semester points for semester >= 7', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ semester: '7' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.semesterPts).toBe(10);
    });

    it('awards 0 semester points for semester < 7 (junior students)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ semester: '6' })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.semesterPts).toBe(0);
    });

    // ── Trend points (always 5) ───────────────────────────────────────────────

    it('always awards 5 trend points', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.trendPts).toBe(5);
    });

    // ── Subject rows mapping ──────────────────────────────────────────────────

    it('maps ia3 null correctly (null stays null, not coerced to 0)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([makeSubjectRow({ ia3: null })]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects[0].ia3).toBeNull();
    });

    it('maps ia1 and ia2 to numbers when present', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([makeSubjectRow({ ia1: '17', ia2: '19', ia3: '20' })]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects[0].ia1).toBe(17);
      expect(profile.subjects[0].ia2).toBe(19);
      expect(profile.subjects[0].ia3).toBe(20);
    });

    it('returns empty subjects array when student has no internal marks', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects).toHaveLength(0);
    });

    it('maps multiple subjects correctly', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([
          makeSubjectRow({ subject_name: 'OS', ia1: '18' }),
          makeSubjectRow({ subject_name: 'DBMS', ia1: '16', ia2: '17' }),
        ]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects).toHaveLength(2);
      expect(profile.subjects[0].name).toBe('OS');
      expect(profile.subjects[1].name).toBe('DBMS');
    });

    it('all three PLACEMENT_READY / NEEDS_COACHING / HIGH_RISK status values round-trip', async () => {
      for (const status of ['PLACEMENT_READY', 'NEEDS_COACHING', 'HIGH_RISK'] as const) {
        const query = jest
          .fn()
          .mockResolvedValueOnce([makeScoreRow({ placement_status: status })])
          .mockResolvedValueOnce([]);
        await buildModule(query);
        const profile = await service.getStudentProfile('1RV21CS001');
        expect(profile.placementStatus).toBe(status);
      }
    });
  });

  // ── getDepartmentSummary ───────────────────────────────────────────────────

  describe('getDepartmentSummary()', () => {
    it('queries with no filters when called with no args', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getDepartmentSummary();
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toHaveLength(0);
      expect(sql).not.toContain('WHERE');
    });

    it('builds WHERE clause for department only', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getDepartmentSummary('CSE');
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['CSE']);
      expect(sql).toContain('WHERE department = $1');
    });

    it('builds WHERE clause for semester only', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getDepartmentSummary(undefined, 8);
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual([8]);
      expect(sql).toContain('WHERE');
      expect(sql).toContain('semester = $1');
    });

    it('builds WHERE ... AND clause for both department and semester', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getDepartmentSummary('ECE', 6);
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['ECE', 6]);
      expect(sql).toContain('department = $1');
      expect(sql).toContain('AND');
      expect(sql).toContain('semester = $2');
    });

    it('returns the raw query result rows', async () => {
      const rows = [{ department: 'CSE', semester: 8, total: '45', ready: '30' }];
      const query = jest.fn().mockResolvedValue(rows);
      await buildModule(query);
      const result = await service.getDepartmentSummary('CSE', 8);
      expect(result).toBe(rows);
    });
  });

  // ── getTopStudents ─────────────────────────────────────────────────────────

  describe('getTopStudents()', () => {
    it('queries with correct department, semester, and default limit 20', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getTopStudents('CSE', 8);
      const [, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['CSE', 8, 20]);
    });

    it('respects custom limit parameter', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getTopStudents('ISE', 6, 5);
      const [, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params[2]).toBe(5);
    });

    it('returns the raw query results', async () => {
      const rows = [{ usn: '1RV21CS001', name: 'Alice', readiness_score: 85 }];
      const query = jest.fn().mockResolvedValue(rows);
      await buildModule(query);
      const result = await service.getTopStudents('CSE', 8);
      expect(result).toBe(rows);
    });

    it('returns empty array when no students match', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      const result = await service.getTopStudents('MECH', 4);
      expect(result).toEqual([]);
    });
  });

  // ── getAllReadyStudents ────────────────────────────────────────────────────

  describe('getAllReadyStudents()', () => {
    it('uses default minScore of 60 when called without args', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getAllReadyStudents();
      const [, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual([60]);
    });

    it('passes custom minScore to the query', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getAllReadyStudents(75);
      const [, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual([75]);
    });

    it('returns all students above threshold', async () => {
      const rows = [
        { usn: '1RV21CS001', readiness_score: 85 },
        { usn: '1RV21CS002', readiness_score: 72 },
      ];
      const query = jest.fn().mockResolvedValue(rows);
      await buildModule(query);
      const result = await service.getAllReadyStudents(60);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no students meet the minimum score', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      const result = await service.getAllReadyStudents(99);
      expect(result).toEqual([]);
    });
  });
});
