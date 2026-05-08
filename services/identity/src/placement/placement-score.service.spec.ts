import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { PlacementScoreService } from './placement-score.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeScoreRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    usn: '1RV21CS001',
    name: 'Alice Sharma',
    department: 'CSE',
    semester: '8',
    section: 'A',
    cgpa: '8.5',
    attendance_pct: '85',
    backlogs: '0',
    readiness_score: '78',
    placement_status: 'PLACEMENT_READY',
    ...overrides,
  };
}

// Rows from the ia_marks JOIN query — each row is ONE IA entry for a subject.
// ia_number: 1 | 2 | 3  (which IA exam)
// marks: marks obtained (string from DB, or null)
// max_marks: maximum possible marks
// subject_name: from subjects join
function makeIaMarkRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ia_number: '1',
    marks: '18',
    max_marks: '20',
    subject_name: 'Operating Systems',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Module builder
// ---------------------------------------------------------------------------

let service: PlacementScoreService;
let mockQuery: jest.Mock;

async function buildModule(queryImpl: jest.Mock) {
  mockQuery = queryImpl;
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PlacementScoreService,
      {
        provide: getDataSourceToken(),
        useValue: { query: queryImpl },
      },
    ],
  }).compile();
  service = module.get<PlacementScoreService>(PlacementScoreService);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PlacementScoreService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── getStudentProfile ──────────────────────────────────────────────────────

  describe('getStudentProfile()', () => {
    it('returns full profile for a known USN with no ia marks', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([]);   // ia_marks returns empty (subjects query silently caught)
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
      expect(profile.subjects).toHaveLength(0);
    });

    it('returns synthetic demo profile when student USN does not exist (was 404, now graceful demo fallback for empty DB)', async () => {
      // Per Sujit/Anand demo-readiness: empty DB must not throw — returns
      // a realistic synthesized profile so the placement portal never blanks
      // out for evaluators clicking around with no real data seeded yet.
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);

      const profile = await service.getStudentProfile('UNKNOWN_USN');
      expect(profile.usn).toBe('UNKNOWN_USN');
      expect(profile.readinessScore).toBeGreaterThan(0);
      expect(profile.subjects.length).toBeGreaterThan(0);
    });

    // ── CGPA score boundary conditions ───────────────────────────────────────

    it('awards 35 CGPA points when cgpa >= 9', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ cgpa: '9.2' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.cgpaPts).toBe(35);
    });

    it('awards 28 CGPA points when cgpa is exactly 8.0 (boundary between tier8 and tier7)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ cgpa: '8.0' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.cgpaPts).toBe(28);
    });

    it('awards 20 CGPA points when cgpa is exactly 7.0 (boundary between tier7 and tier6)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ cgpa: '7.0' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.cgpaPts).toBe(20);
    });

    it('awards 12 CGPA points when cgpa is exactly 6.0 (boundary between tier6 and low)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ cgpa: '6.0' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.cgpaPts).toBe(12);
    });

    it('awards 5 CGPA points when cgpa < 6 (high-risk student)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ cgpa: '5.9' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.cgpaPts).toBe(5);
    });

    // ── Attendance score boundary conditions (VTU-specific) ───────────────────

    it('awards 25 attendance points when attendance >= 90%', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ attendance_pct: '90' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.attendancePts).toBe(25);
    });

    it('awards 18 attendance points when attendance is exactly 80% (tier80 boundary)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ attendance_pct: '80' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.attendancePts).toBe(18);
    });

    it('awards 10 attendance points at exactly 75% (VTU minimum detention boundary)', async () => {
      // 75% is the VTU threshold — student is eligible but on the knife-edge.
      // Scoring must not confuse 75% with "detained" status.
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ attendance_pct: '75' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.attendancePts).toBe(10);
    });

    it('awards 3 attendance points when attendance < 75% (detained-risk student)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ attendance_pct: '74' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.attendancePts).toBe(3);
    });

    // ── Backlog score conditions ──────────────────────────────────────────────

    it('awards 20 backlog points when backlogs = 0 (clean academic record)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ backlogs: '0' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.backlogPts).toBe(20);
    });

    it('awards 12 backlog points for 1 backlog (20 - 8*1)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ backlogs: '1' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.backlogPts).toBe(12);
    });

    it('clamps backlog points to 0 when 3+ backlogs (does not go negative)', async () => {
      // 20 - (3 * 8) = -4 → clamped to 0
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ backlogs: '3' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.backlogPts).toBe(0);
    });

    it('clamps to 0 for extreme backlogs (5 backlogs — 20 - 40 = -20 → 0)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ backlogs: '5' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.backlogPts).toBe(0);
    });

    // ── Semester points ───────────────────────────────────────────────────────

    it('awards 10 semester points for semester = 7 (first eligible semester)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ semester: '7' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.semesterPts).toBe(10);
    });

    it('awards 10 semester points for semester = 8 (final semester)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ semester: '8' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.semesterPts).toBe(10);
    });

    it('awards 0 semester points for semester = 6 (below final-year threshold)', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow({ semester: '6' })]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.semesterPts).toBe(0);
    });

    // ── Trend points (always TREND_PTS_NEUTRAL = 5) ───────────────────────────

    it('always awards 5 trend points regardless of other scores', async () => {
      const query = jest.fn().mockResolvedValueOnce([makeScoreRow()]).mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.scoreBreakdown.trendPts).toBe(5);
    });

    // ── IA marks mapping via ia_marks JOIN ────────────────────────────────────

    it('maps a single IA1 row to ia1, leaves ia2/ia3 null', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([makeIaMarkRow({ ia_number: '1', marks: '18' })]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects).toHaveLength(1);
      expect(profile.subjects[0].ia1).toBe(18);
      expect(profile.subjects[0].ia2).toBeNull();
      expect(profile.subjects[0].ia3).toBeNull();
    });

    it('maps three separate ia_marks rows into a single subject with ia1, ia2, ia3', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([
          makeIaMarkRow({ ia_number: '1', marks: '17', subject_name: 'DBMS' }),
          makeIaMarkRow({ ia_number: '2', marks: '19', subject_name: 'DBMS' }),
          makeIaMarkRow({ ia_number: '3', marks: '20', subject_name: 'DBMS' }),
        ]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects).toHaveLength(1);
      expect(profile.subjects[0].name).toBe('DBMS');
      expect(profile.subjects[0].ia1).toBe(17);
      expect(profile.subjects[0].ia2).toBe(19);
      expect(profile.subjects[0].ia3).toBe(20);
    });

    it('ia marks with null marks value map to null (absent exam)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([
          makeIaMarkRow({ ia_number: '2', marks: null, subject_name: 'Networks' }),
        ]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects[0].ia2).toBeNull();
    });

    it('groups multiple subjects correctly from ia_marks rows', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([
          makeIaMarkRow({ ia_number: '1', marks: '18', subject_name: 'OS', max_marks: '20' }),
          makeIaMarkRow({ ia_number: '1', marks: '16', subject_name: 'DBMS', max_marks: '20' }),
          makeIaMarkRow({ ia_number: '2', marks: '17', subject_name: 'DBMS', max_marks: '20' }),
        ]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects).toHaveLength(2);
      const names = profile.subjects.map((s) => s.name);
      expect(names).toContain('OS');
      expect(names).toContain('DBMS');
    });

    it('returns empty subjects array when ia_marks query returns empty', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects).toHaveLength(0);
    });

    it('subjects query failure is silently caught — profile still returned with empty subjects', async () => {
      // The .catch(() => []) in the service means ia_marks errors don't bubble up
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockRejectedValueOnce(new Error('ia_marks table does not exist'));
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects).toHaveLength(0);
      expect(profile.usn).toBe('1RV21CS001');
    });

    it('max_marks is taken as the maximum across all ia_marks rows for a subject', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([
          makeIaMarkRow({ ia_number: '1', marks: '18', max_marks: '20', subject_name: 'OS' }),
          makeIaMarkRow({ ia_number: '2', marks: '19', max_marks: '25', subject_name: 'OS' }),
        ]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      // Math.max(0, 20, 25) = 25
      expect(profile.subjects[0].max).toBe(25);
    });

    it('round-trips all three placement status values', async () => {
      for (const status of ['PLACEMENT_READY', 'NEEDS_COACHING', 'HIGH_RISK'] as const) {
        const q = jest.fn()
          .mockResolvedValueOnce([makeScoreRow({ placement_status: status })])
          .mockResolvedValueOnce([]);
        await buildModule(q);
        const profile = await service.getStudentProfile('1RV21CS001');
        expect(profile.placementStatus).toBe(status);
      }
    });

    it('handles missing section gracefully (falls back to empty string)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow({ section: null })])
        .mockResolvedValueOnce([]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.section).toBe('');
    });

    it('falls back to "Unknown" when ia_marks row has null subject_name (covers ?? branch)', async () => {
      // Covers line 73: String(row['subject_name'] ?? 'Unknown') — the 'Unknown' branch
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([makeIaMarkRow({ subject_name: null, ia_number: '1', marks: '15', max_marks: '20' })]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      expect(profile.subjects).toHaveLength(1);
      expect(profile.subjects[0].name).toBe('Unknown');
    });

    it('treats null max_marks as 0 in Math.max calculation (covers ?? 0 branch)', async () => {
      // Covers line 81: +String(row['max_marks'] ?? 0) — the ?? 0 branch
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeScoreRow()])
        .mockResolvedValueOnce([makeIaMarkRow({ ia_number: '1', marks: '15', max_marks: null, subject_name: 'Physics' })]);
      await buildModule(query);
      const profile = await service.getStudentProfile('1RV21CS001');
      // Math.max(0, +String(null ?? 0)) = Math.max(0, 0) = 0
      expect(profile.subjects[0].max).toBe(0);
    });
  });

  // ── getDepartmentSummary ───────────────────────────────────────────────────

  describe('getDepartmentSummary()', () => {
    it('queries with no positional filter params when called with no args', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getDepartmentSummary();
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toHaveLength(0);
      // SQL contains FILTER (WHERE ...) aggregate clauses — check that no user-scoped
      // WHERE filter for department or semester was injected.
      expect(sql).not.toContain('WHERE department');
      expect(sql).not.toContain('WHERE semester');
    });

    it('injects WHERE department = $1 when department is provided', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getDepartmentSummary('CSE');
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['CSE']);
      expect(sql).toContain('WHERE department = $1');
    });

    it('injects WHERE semester = $1 when only semester is provided', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getDepartmentSummary(undefined, 8);
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual([8]);
      expect(sql).toContain('semester = $1');
    });

    it('injects WHERE department = $1 AND semester = $2 when both provided', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getDepartmentSummary('ECE', 6);
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['ECE', 6]);
      expect(sql).toContain('department = $1');
      expect(sql).toContain('AND');
      expect(sql).toContain('semester = $2');
    });

    it('returns raw query results', async () => {
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

    it('uses custom limit when provided', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getTopStudents('ISE', 6, 5);
      const [, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params[2]).toBe(5);
    });

    it('returns raw query results', async () => {
      const rows = [{ usn: '1RV21CS001', readiness_score: 85 }];
      const query = jest.fn().mockResolvedValue(rows);
      await buildModule(query);
      const result = await service.getTopStudents('CSE', 8);
      expect(result).toBe(rows);
    });

    it('returns empty array when no students match the filter', async () => {
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

    it('returns students above the score threshold', async () => {
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
