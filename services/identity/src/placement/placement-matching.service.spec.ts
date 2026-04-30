import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { PlacementMatchingService } from './placement-matching.service';

// ---------------------------------------------------------------------------
// Mock @anthropic-ai/sdk at module level (must precede imports that use it)
// ---------------------------------------------------------------------------

const mockAnthropicCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockAnthropicCreate,
      },
    })),
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCompanyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'co-1',
    name: 'Infosys',
    role_offered: 'SDE Intern',
    ctc_lpa: '6',
    company_type: 'SERVICE',
    min_cgpa: '7.0',
    eligible_branches: ['CSE', 'ISE'],
    eligible_semesters: [7, 8],
    required_skills: ['Java', 'Python'],
    ...overrides,
  };
}

function makeEligibleStudent(usn: string, readinessScore = 75): Record<string, unknown> {
  return {
    usn,
    name: `Student ${usn}`,
    cgpa: '8.0',
    attendance_pct: '85',
    readiness_score: String(readinessScore),
    department: 'CSE',
    parent_email: `parent-${usn}@test.com`,
    phone: '+919876543210',
  };
}

function makeMatchRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fit_score: 80,
    prediction_pct: 60,
    claude_rationale: 'Strong CGPA and attendance.',
    status: 'PENDING',
    company_name: 'Infosys',
    role_offered: 'SDE',
    ctc_lpa: '6',
    company_type: 'SERVICE',
    industry: 'IT',
    drive_date: '2026-08-01',
    required_skills: ['Java'],
    ...overrides,
  };
}

function makeStudentMatchRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fit_score: 85,
    prediction_pct: 70,
    claude_rationale: 'High readiness score.',
    status: 'PENDING',
    name: 'Alice Sharma',
    usn: '1RV21CS001',
    department: 'CSE',
    cgpa: '8.5',
    attendance_pct: '90',
    readiness_score: '82',
    ...overrides,
  };
}

function anthropicTextResponse(json: unknown): Record<string, unknown> {
  return {
    content: [{ type: 'text', text: JSON.stringify(json) }],
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PlacementMatchingService', () => {
  let service: PlacementMatchingService;
  let mockQuery: jest.Mock;

  async function buildModule(queryImpl: jest.Mock) {
    mockQuery = queryImpl;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacementMatchingService,
        {
          provide: getDataSourceToken(),
          useValue: { query: queryImpl },
        },
      ],
    }).compile();
    service = module.get<PlacementMatchingService>(PlacementMatchingService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── matchStudentsToCompany — company not found ────────────────────────────

  describe('matchStudentsToCompany()', () => {
    it('throws when company does not exist', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([]);   // empty company result
      await buildModule(query);

      await expect(service.matchStudentsToCompany('nonexistent-id')).rejects.toThrow('Company not found');
    });

    // ── empty eligible students ───────────────────────────────────────────────

    it('returns 0 when no eligible students match criteria', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeCompanyRow()])   // company found
        .mockResolvedValueOnce([]);                  // no eligible students
      await buildModule(query);

      const result = await service.matchStudentsToCompany('co-1');

      expect(result).toBe(0);
      // Claude should NOT be called when eligible list is empty
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });

    // ── Claude success path ───────────────────────────────────────────────────

    it('saves Claude matches and returns count on success path', async () => {
      const students = [
        makeEligibleStudent('1RV21CS001', 80),
        makeEligibleStudent('1RV21CS002', 72),
      ];
      const claudeMatches = [
        { usn: '1RV21CS001', fitScore: 88, offerProbability: 70, rationale: 'Great CGPA.' },
        { usn: '1RV21CS002', fitScore: 75, offerProbability: 55, rationale: 'Good attendance.' },
      ];

      const query = jest
        .fn()
        .mockResolvedValueOnce([makeCompanyRow()])
        .mockResolvedValueOnce(students)
        .mockResolvedValue([]);   // upsert calls

      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(claudeMatches));

      await buildModule(query);
      const count = await service.matchStudentsToCompany('co-1');

      expect(count).toBe(2);
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);

      // Verify upsert was called for each match
      const upsertCalls = query.mock.calls.slice(2); // skip company + eligible queries
      expect(upsertCalls).toHaveLength(2);
      expect(upsertCalls[0][1]).toContain('1RV21CS001');
      expect(upsertCalls[1][1]).toContain('1RV21CS002');
    });

    it('caps students sent to Claude at 50 when eligible list exceeds 50', async () => {
      const fiftyTwoStudents = Array.from({ length: 52 }, (_, i) =>
        makeEligibleStudent(`1RV21CS${String(i).padStart(3, '0')}`, 70 + i),
      );
      const claudeMatches = fiftyTwoStudents.slice(0, 50).map((s) => ({
        usn: s['usn'],
        fitScore: 75,
        offerProbability: 55,
        rationale: 'Adequate.',
      }));

      const query = jest
        .fn()
        .mockResolvedValueOnce([makeCompanyRow()])
        .mockResolvedValueOnce(fiftyTwoStudents)
        .mockResolvedValue([]);

      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(claudeMatches));

      await buildModule(query);
      const count = await service.matchStudentsToCompany('co-1');

      // Only first 50 sent to Claude; returned 50 matches, all saved
      expect(count).toBe(50);
      const promptArg = mockAnthropicCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
      // The prompt must not contain the 51st student's USN
      expect(promptArg.messages[0].content).not.toContain('1RV21CS050');
    });

    // ── Claude error fallback path ────────────────────────────────────────────

    it('falls back to readiness-score-based matches when Claude throws', async () => {
      const students = [
        makeEligibleStudent('1RV21CS001', 80),
        makeEligibleStudent('1RV21CS002', 70),
      ];

      const query = jest
        .fn()
        .mockResolvedValueOnce([makeCompanyRow()])
        .mockResolvedValueOnce(students)
        .mockResolvedValue([]);

      mockAnthropicCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      await buildModule(query);
      const count = await service.matchStudentsToCompany('co-1');

      expect(count).toBe(2);
      // Verify fallback scores are derived from readiness_score
      const firstUpsertParams = query.mock.calls[2][1] as unknown[];
      // fitScore = round(80 * 0.9) = 72
      expect(firstUpsertParams[2]).toBe(72);
      // offerProbability = round(80 * 0.7) = 56
      expect(firstUpsertParams[3]).toBe(56);
    });

    it('fallback rationale references the readiness score', async () => {
      const students = [makeEligibleStudent('1RV21CS001', 80)];

      const query = jest
        .fn()
        .mockResolvedValueOnce([makeCompanyRow()])
        .mockResolvedValueOnce(students)
        .mockResolvedValue([]);

      mockAnthropicCreate.mockRejectedValueOnce(new Error('timeout'));

      await buildModule(query);
      await service.matchStudentsToCompany('co-1');

      const upsertParams = query.mock.calls[2][1] as unknown[];
      expect(String(upsertParams[4])).toContain('80');
    });

    // ── DB upsert errors — logged, not thrown ─────────────────────────────────

    it('logs upsert failures but continues and returns only successful saves', async () => {
      const students = [
        makeEligibleStudent('1RV21CS001', 80),
        makeEligibleStudent('1RV21CS002', 72),
      ];
      const claudeMatches = [
        { usn: '1RV21CS001', fitScore: 85, offerProbability: 65, rationale: 'Good.' },
        { usn: '1RV21CS002', fitScore: 78, offerProbability: 58, rationale: 'Decent.' },
      ];

      const query = jest
        .fn()
        .mockResolvedValueOnce([makeCompanyRow()])
        .mockResolvedValueOnce(students)
        .mockResolvedValueOnce([])                          // first upsert succeeds
        .mockRejectedValueOnce(new Error('DB constraint')); // second upsert fails

      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(claudeMatches));

      await buildModule(query);

      // Must not throw — DB upsert errors are swallowed
      const count = await service.matchStudentsToCompany('co-1');
      expect(count).toBe(1); // only 1 succeeded
    });

    it('returns 0 when all upserts fail', async () => {
      const students = [makeEligibleStudent('1RV21CS001', 80)];
      const claudeMatches = [
        { usn: '1RV21CS001', fitScore: 85, offerProbability: 65, rationale: 'Good.' },
      ];

      const query = jest
        .fn()
        .mockResolvedValueOnce([makeCompanyRow()])
        .mockResolvedValueOnce(students)
        .mockRejectedValueOnce(new Error('DB down'));

      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(claudeMatches));

      await buildModule(query);
      const count = await service.matchStudentsToCompany('co-1');
      expect(count).toBe(0);
    });

    // ── Claude returns non-text content block ─────────────────────────────────

    it('uses empty matches array when Claude returns non-text content block', async () => {
      const students = [makeEligibleStudent('1RV21CS001', 80)];

      const query = jest
        .fn()
        .mockResolvedValueOnce([makeCompanyRow()])
        .mockResolvedValueOnce(students);

      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'image', source: {} }],
      });

      await buildModule(query);
      // Falls into JSON.parse('[]') path → 0 saved
      const count = await service.matchStudentsToCompany('co-1');
      expect(count).toBe(0);
    });

    // ── required_skills null guard ────────────────────────────────────────────

    it('handles null required_skills in company row without crashing', async () => {
      const students = [makeEligibleStudent('1RV21CS001', 80)];
      const query = jest
        .fn()
        .mockResolvedValueOnce([makeCompanyRow({ required_skills: null })])
        .mockResolvedValueOnce(students)
        .mockResolvedValue([]);

      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse([
        { usn: '1RV21CS001', fitScore: 80, offerProbability: 60, rationale: 'OK.' },
      ]));

      await buildModule(query);
      await expect(service.matchStudentsToCompany('co-1')).resolves.toBe(1);
    });
  });

  // ── getMatchesForStudent ───────────────────────────────────────────────────

  describe('getMatchesForStudent()', () => {
    it('returns matches ordered by fit_score descending', async () => {
      const rows = [makeMatchRow({ fit_score: 90 }), makeMatchRow({ fit_score: 70 })];
      const query = jest.fn().mockResolvedValue(rows);
      await buildModule(query);

      const result = await service.getMatchesForStudent('1RV21CS001');
      expect(result).toBe(rows);
      const [, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['1RV21CS001']);
    });

    it('returns empty array when student has no matches yet', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      const result = await service.getMatchesForStudent('1RV21CS999');
      expect(result).toEqual([]);
    });
  });

  // ── getTopStudentsForCompany ───────────────────────────────────────────────

  describe('getTopStudentsForCompany()', () => {
    it('queries with default limit 15', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getTopStudentsForCompany('co-1');
      const [, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['co-1', 15]);
    });

    it('respects custom limit parameter', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      await service.getTopStudentsForCompany('co-1', 5);
      const [, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params[1]).toBe(5);
    });

    it('returns student rows ordered by fit_score', async () => {
      const rows = [makeStudentMatchRow({ fit_score: 92 }), makeStudentMatchRow({ fit_score: 78 })];
      const query = jest.fn().mockResolvedValue(rows);
      await buildModule(query);
      const result = await service.getTopStudentsForCompany('co-1', 10);
      expect(result).toBe(rows);
    });

    it('returns empty array when no matches for company', async () => {
      const query = jest.fn().mockResolvedValue([]);
      await buildModule(query);
      const result = await service.getTopStudentsForCompany('co-new');
      expect(result).toEqual([]);
    });
  });
});
