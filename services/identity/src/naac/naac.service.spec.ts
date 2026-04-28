/**
 * naac.service.spec.ts
 *
 * Unit tests for NaacService.
 * All database access is mocked; all fs.readFileSync calls are intercepted so
 * the real naac-metrics.json is never touched.  Every public method, every
 * conditional branch, and every error path is covered.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import { NaacService, MetricConfig } from './naac.service';

// ─── Selective fs mock ────────────────────────────────────────────────────────
// We spy on fs.readFileSync only, so that TypeORM's internal path resolution
// (which also calls fs/path) is not disrupted.
jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  readFileSync: jest.fn(),
}));

// ─── Minimal NAAC config used across all tests ───────────────────────────────
const MOCK_CONFIG = {
  institution: {
    name: 'Test College',
    shortName: 'TC',
    affiliation: 'Test University',
    city: 'Bengaluru',
    state: 'Karnataka',
    type: 'Engineering College',
    naacGradeThresholds: {
      'A++': 3.51,
      'A+': 3.26,
      'A': 3.01,
      'B++': 2.76,
      'B+': 2.51,
      'B': 2.01,
      'C': 1.51,
    },
  },
  criteria: [
    {
      id: 'C2',
      name: 'Teaching-Learning and Evaluation',
      weightage: 350,
      metrics: [
        {
          id: '2.1.1',
          name: 'Student Enrolment Rate',
          description: 'Enrolment vs sanctioned intake',
          maxScore: 20,
          dataSource: 'auto',
          sqlQuery: 'SELECT enrollment_pct FROM students',
          scoreFormula: 'enrollment_pct >= 90 ? 20 : enrollment_pct >= 80 ? 16 : enrollment_pct >= 70 ? 12 : 8',
          evidenceColumns: ['Programme', 'Intake', 'Enrolled', '%'],
          evidenceType: 'quantitative',
        },
        {
          id: '2.2.1',
          name: 'Student-Teacher Ratio',
          description: 'Ratio of students to faculty',
          maxScore: 20,
          dataSource: 'auto',
          sqlQuery: 'SELECT ratio FROM faculty',
          scoreFormula: 'ratio <= 20 ? 20 : ratio <= 25 ? 16 : ratio <= 30 ? 12 : 8',
          evidenceColumns: ['Year', 'Students', 'Faculty', 'Ratio'],
          evidenceType: 'quantitative',
        },
        {
          id: '2.4.1',
          name: 'Full-time teachers with PhD',
          description: 'Percentage with doctoral qualification',
          maxScore: 20,
          dataSource: 'manual',
          evidenceType: 'quantitative',
        },
      ],
    },
    {
      id: 'C5',
      name: 'Student Support and Progression',
      weightage: 130,
      metrics: [
        {
          id: '5.1.3',
          name: 'Student-Parent Engagement',
          description: 'Parent engagement via voice calls',
          maxScore: 20,
          dataSource: 'auto',
          sqlQuery: 'SELECT engagement_pct FROM ai_call_logs LIMIT 1',
          scoreFormula: 'engagement_pct >= 50 ? 20 : engagement_pct >= 25 ? 16 : 12',
          evidenceColumns: ['Year', 'Students', 'Engagement %'],
          evidenceType: 'mixed',
          edaiNote: 'Voice calls serve as NAAC evidence',
        },
      ],
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Bootstrap a NaacService with an optional mock DataSource. */
async function buildService(mockDb: Partial<DataSource> | null): Promise<NaacService> {
  // Make readFileSync return our test config regardless of the path argument.
  (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(MOCK_CONFIG));

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NaacService,
      { provide: DataSource, useValue: mockDb },
    ],
  }).compile();

  return module.get<NaacService>(NaacService);
}

/** Helper: returns a mock DataSource whose query() resolves in call order. */
function makeDb(...results: unknown[]): { query: jest.Mock } {
  const mock = { query: jest.fn() };
  let chain = mock.query as jest.Mock;
  for (const r of results) {
    if (r instanceof Error) {
      chain = chain.mockRejectedValueOnce(r) as jest.Mock;
    } else {
      chain = chain.mockResolvedValueOnce(r) as jest.Mock;
    }
  }
  return mock;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('NaacService', () => {
  afterEach(() => jest.clearAllMocks());

  // ── Constructor / config loading ──────────────────────────────────────────

  describe('constructor', () => {
    it('calls fs.readFileSync exactly once with utf-8 encoding to load naac-metrics.json', async () => {
      await buildService(makeDb([{ enrollment_pct: 85 }], [{ ratio: 20 }], [{ engagement_pct: 30 }]));
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      // The second argument must be 'utf-8' — binary reads would return a Buffer
      expect((fs.readFileSync as jest.Mock).mock.calls[0][1]).toBe('utf-8');
      // Path must end with the expected filename
      expect((fs.readFileSync as jest.Mock).mock.calls[0][0]).toMatch(/naac-metrics\.json$/);
    });
  });

  // ── getAllCriteria ─────────────────────────────────────────────────────────

  describe('getAllCriteria()', () => {
    it('returns all criteria from the loaded config', async () => {
      const svc = await buildService(null);
      const all = svc.getAllCriteria();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe('C2');
      expect(all[1].id).toBe('C5');
    });
  });

  // ── getCriterionConfig ────────────────────────────────────────────────────

  describe('getCriterionConfig()', () => {
    it('returns the correct config for a valid criterion ID', async () => {
      const svc = await buildService(null);
      const cfg = svc.getCriterionConfig('C2');
      expect(cfg).toBeDefined();
      expect(cfg!.name).toBe('Teaching-Learning and Evaluation');
      expect(cfg!.weightage).toBe(350);
    });

    it('returns undefined for an unknown criterion ID', async () => {
      const svc = await buildService(null);
      expect(svc.getCriterionConfig('C99')).toBeUndefined();
    });

    it('returns undefined for an empty string', async () => {
      const svc = await buildService(null);
      expect(svc.getCriterionConfig('')).toBeUndefined();
    });
  });

  // ── cgpaToGrade ───────────────────────────────────────────────────────────

  describe('cgpaToGrade()', () => {
    const table: [number, string][] = [
      [4.0,  'A++'],
      [3.51, 'A++'], // exact threshold — boundary
      [3.50, 'A+'],  // just below A++ threshold
      [3.26, 'A+'],  // exact A+ threshold
      [3.25, 'A'],   // just below A+
      [3.01, 'A'],   // exact A threshold
      [3.00, 'B++'], // just below A
      [2.76, 'B++'], // exact B++ threshold
      [2.75, 'B+'],  // just below B++
      [2.51, 'B+'],  // exact B+ threshold
      [2.50, 'B'],   // just below B+
      [2.01, 'B'],   // exact B threshold
      [2.00, 'C'],   // just below B
      [1.51, 'C'],   // exact C threshold
      [1.50, 'D'],   // just below C
      [0.00, 'D'],   // minimum
    ];

    it.each(table)('CGPA %f → grade %s', async (cgpa, expected) => {
      const svc = await buildService(null);
      const grade = svc.cgpaToGrade(cgpa);
      expect(grade).toBe(expected);
    });
  });

  // ── computeMetric — manual branch ─────────────────────────────────────────

  describe('computeMetric() — manual dataSource', () => {
    it('returns MANUAL status with 70% estimated earnedScore', async () => {
      const svc = await buildService(null);
      const metric: MetricConfig = {
        id: '2.4.1',
        name: 'PhD Faculty',
        description: 'Doctoral qualification %',
        maxScore: 20,
        dataSource: 'manual',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.status).toBe('MANUAL');
      expect(result.earnedScore).toBe(14); // 70% of 20
      expect(result.liveData).toBeNull();
      expect(result.dataSource).toBe('manual');
    });

    it('rounds the 70% estimate to 2 decimal places', async () => {
      const svc = await buildService(null);
      const metric: MetricConfig = {
        id: '2.4.2',
        name: 'Manual Odd',
        description: 'Odd maxScore',
        maxScore: 15,
        dataSource: 'manual',
        evidenceType: 'qualitative',
      };

      const result = await svc.computeMetric(metric);
      expect(result.earnedScore).toBe(10.5); // 70% of 15
    });

    it('does NOT include edaiNote when absent on manual metric', async () => {
      const svc = await buildService(null);
      const metric: MetricConfig = {
        id: '2.4.3',
        name: 'No Note',
        description: 'desc',
        maxScore: 10,
        dataSource: 'manual',
        evidenceType: 'qualitative',
      };
      const result = await svc.computeMetric(metric);
      expect(result.edaiNote).toBeUndefined();
    });

    it('passes edaiNote through when present on manual metric', async () => {
      const svc = await buildService(null);
      const metric: MetricConfig = {
        id: '2.4.4',
        name: 'With Note',
        description: 'desc',
        maxScore: 10,
        dataSource: 'manual',
        evidenceType: 'qualitative',
        edaiNote: 'Manual evidence required from IQAC',
      };
      const result = await svc.computeMetric(metric);
      expect(result.edaiNote).toBe('Manual evidence required from IQAC');
    });
  });

  // ── computeMetric — auto branch, DB is null ───────────────────────────────

  describe('computeMetric() — auto dataSource, no DB', () => {
    it('returns ERROR status with null earnedScore when db is not injected', async () => {
      const svc = await buildService(null);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Enrolment',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT 1',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.status).toBe('ERROR');
      expect(result.earnedScore).toBeNull();
      expect(result.liveData).toBeNull();
    });

    it('still carries edaiNote through on ERROR path', async () => {
      const svc = await buildService(null);
      const metric: MetricConfig = {
        id: '5.1.3',
        name: 'Engagement',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT 1',
        evidenceType: 'mixed',
        edaiNote: 'Voice calls serve as NAAC evidence',
      };
      const result = await svc.computeMetric(metric);
      expect(result.edaiNote).toBe('Voice calls serve as NAAC evidence');
    });
  });

  // ── computeMetric — auto branch, DB present ───────────────────────────────

  describe('computeMetric() — auto dataSource, DB present', () => {
    it('returns OK status with correctly evaluated score', async () => {
      const db = makeDb([{ enrollment_pct: 85 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Enrolment',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT enrollment_pct FROM students',
        scoreFormula: 'enrollment_pct >= 90 ? 20 : enrollment_pct >= 80 ? 16 : 12',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.status).toBe('OK');
      expect(result.earnedScore).toBe(16);
      expect(result.liveData).toEqual({ enrollment_pct: 85 });
    });

    it('returns ERROR status and null earnedScore when DB query throws an Error instance', async () => {
      const db = makeDb(new Error('relation "students" does not exist'));
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Enrolment',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT enrollment_pct FROM students',
        scoreFormula: 'enrollment_pct >= 90 ? 20 : 16',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.status).toBe('ERROR');
      expect(result.earnedScore).toBeNull();
      expect(result.liveData).toBeNull();
    });

    it('returns ERROR status when DB query rejects with a non-Error value (string throw)', async () => {
      // Covers the String(err) branch in the catch logger.warn call
      const db = { query: jest.fn().mockRejectedValueOnce('connection refused') };
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Enrolment',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT enrollment_pct FROM students',
        scoreFormula: 'enrollment_pct >= 90 ? 20 : 16',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.status).toBe('ERROR');
      expect(result.earnedScore).toBeNull();
    });

    it('converts string-typed numeric column values to numbers (numericifyRow)', async () => {
      const db = makeDb([{ enrollment_pct: '92.5' }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Enrolment',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT enrollment_pct FROM students',
        scoreFormula: 'enrollment_pct >= 90 ? 20 : 16',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.status).toBe('OK');
      expect(result.earnedScore).toBe(20);
      expect((result.liveData as Record<string, unknown>)['enrollment_pct']).toBe(92.5);
    });

    it('keeps non-numeric column values as strings after numericifyRow', async () => {
      const db = makeDb([{ label: 'active', count: '10' }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.9',
        name: 'Mixed row',
        description: 'desc',
        maxScore: 10,
        dataSource: 'auto',
        sqlQuery: 'SELECT label, count FROM students',
        scoreFormula: 'count >= 5 ? 10 : 5',
        evidenceType: 'qualitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.liveData!['label']).toBe('active');
      expect(result.liveData!['count']).toBe(10);
    });

    it('handles empty result set (no rows) from DB without crashing', async () => {
      const db = makeDb([]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Enrolment',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT enrollment_pct FROM students WHERE 1=0',
        scoreFormula: 'enrollment_pct >= 90 ? 20 : 16',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      // Row is empty object, formula uses undefined variable → falls back to 70%
      expect(result.status).toBe('OK');
      expect(result.earnedScore).toBe(14); // 70% of 20 (NaN fallback)
    });

    it('caps earnedScore at maxScore even when formula returns a value above it', async () => {
      const db = makeDb([{ score: 999 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Overflow test',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT 999 AS score',
        scoreFormula: 'score',   // returns 999, should be capped at 20
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.earnedScore).toBe(20);
    });

    it('floors earnedScore at 0 even when formula returns a negative value', async () => {
      const db = makeDb([{ score: -50 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.2',
        name: 'Negative test',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT -50 AS score',
        scoreFormula: 'score',   // returns -50, should be floored at 0
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.earnedScore).toBe(0);
    });

    it('uses 70% fallback when no scoreFormula is defined', async () => {
      const db = makeDb([{ enrollment_pct: 85 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'No formula',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT enrollment_pct FROM students',
        // scoreFormula intentionally omitted
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.earnedScore).toBe(14); // 70% of 20
    });

    it('uses 70% fallback when scoreFormula throws a syntax error', async () => {
      const db = makeDb([{ enrollment_pct: 85 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Bad formula',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT enrollment_pct FROM students',
        scoreFormula: '!!! invalid formula @@@',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.earnedScore).toBe(14); // 70% of 20
      expect(result.status).toBe('OK');
    });

    it('uses 70% fallback when scoreFormula evaluates to NaN', async () => {
      // The formula must not throw — it must return NaN to hit line 260.
      // Multiplying a string column value by a number yields NaN.
      const db = makeDb([{ label: 'active' }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'NaN formula',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT label FROM students',
        // label is the string 'active' after numericifyRow; multiplying it by 2 returns NaN
        scoreFormula: 'label * 2',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      // NaN result falls back to 70%
      expect(result.earnedScore).toBe(14);
    });

    it('passes edaiNote through to OK result', async () => {
      const db = makeDb([{ engagement_pct: 30 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '5.1.3',
        name: 'Engagement',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT engagement_pct FROM ai_call_logs',
        scoreFormula: 'engagement_pct >= 25 ? 16 : 12',
        evidenceType: 'mixed',
        edaiNote: 'Voice calls serve as NAAC evidence',
      };

      const result = await svc.computeMetric(metric);

      expect(result.edaiNote).toBe('Voice calls serve as NAAC evidence');
    });

    it('does NOT include edaiNote key when absent on auto metric', async () => {
      const db = makeDb([{ enrollment_pct: 85 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Enrolment',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT enrollment_pct FROM students',
        scoreFormula: 'enrollment_pct >= 80 ? 16 : 12',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.edaiNote).toBeUndefined();
    });
  });

  // ── scoreFormula branch coverage (enrolment tiers) ───────────────────────

  describe('scoreFormula — enrolment tier boundaries', () => {
    const makeEnrolmentMetric = (): MetricConfig => ({
      id: '2.1.1',
      name: 'Student Enrolment Rate',
      description: 'desc',
      maxScore: 20,
      dataSource: 'auto',
      sqlQuery: 'SELECT enrollment_pct FROM students',
      scoreFormula:
        'enrollment_pct >= 90 ? 20 : enrollment_pct >= 80 ? 16 : enrollment_pct >= 70 ? 12 : 8',
      evidenceType: 'quantitative',
    });

    it.each([
      [90.0, 20],
      [90.1, 20],
      [85.0, 16],
      [80.0, 16],
      [79.9, 12],
      [70.0, 12],
      [69.9,  8],
      [50.0,  8],
    ])('enrollment_pct %f → earnedScore %i', async (pct, expected) => {
      const db = makeDb([{ enrollment_pct: pct }]);
      const svc = await buildService(db);
      const result = await svc.computeMetric(makeEnrolmentMetric());
      expect(result.earnedScore).toBe(expected);
    });
  });

  // ── getDashboard ──────────────────────────────────────────────────────────

  describe('getDashboard()', () => {
    it('returns a valid dashboard shape', async () => {
      const db = makeDb(
        [{ enrollment_pct: 85 }],
        [{ ratio: 18 }],
        [{ engagement_pct: 30 }],
      );
      const svc = await buildService(db);

      const result = await svc.getDashboard();

      expect(result.institution).toBeDefined();
      expect(result.institution.name).toBe('Test College');
      expect(typeof result.predictedCgpa).toBe('number');
      expect(typeof result.predictedGrade).toBe('string');
      expect(result.criteria).toHaveLength(2);
      expect(result.generatedAt).toBeTruthy();
      expect(typeof result.summary).toBe('object');
    });

    it('predictedCgpa is within 0–4.0 range', async () => {
      const db = makeDb(
        [{ enrollment_pct: 85 }],
        [{ ratio: 18 }],
        [{ engagement_pct: 30 }],
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      expect(result.predictedCgpa).toBeGreaterThanOrEqual(0);
      expect(result.predictedCgpa).toBeLessThanOrEqual(4.0);
    });

    it('weightedScore is 0 when criterion maxScore is 0 (new-institution edge case)', async () => {
      // Build a config with one criterion whose only metric has maxScore 0
      // This hits the pctEarned = 0 branch (maxScore > 0 is false) in computeCriterion
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          ...MOCK_CONFIG,
          criteria: [
            {
              id: 'CX',
              name: 'Zero Max',
              weightage: 100,
              metrics: [
                {
                  id: 'X.1',
                  name: 'Zero metric',
                  description: 'desc',
                  maxScore: 0,
                  dataSource: 'manual',
                  evidenceType: 'qualitative',
                },
              ],
            },
          ],
        }),
      );

      const module = await Test.createTestingModule({
        providers: [
          NaacService,
          { provide: DataSource, useValue: null },
        ],
      }).compile();
      const svc = module.get<NaacService>(NaacService);

      const result = await svc.getDashboard();

      expect(result.criteria[0].weightedScore).toBe(0);
      expect(result.criteria[0].earnedScore).toBe(0);
    });

    it('predictedCgpa is 0 when totalWeightage is 0 (empty criteria)', async () => {
      // Override config with empty criteria list
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ ...MOCK_CONFIG, criteria: [] }),
      );

      const module = await Test.createTestingModule({
        providers: [
          NaacService,
          { provide: DataSource, useValue: null },
        ],
      }).compile();
      const svc = module.get<NaacService>(NaacService);

      const result = await svc.getDashboard();

      expect(result.predictedCgpa).toBe(0);
      expect(result.predictedGrade).toBe('D');
    });

    it('summary.autoMetrics counts metrics with status OK', async () => {
      const db = makeDb(
        [{ enrollment_pct: 85 }],
        [{ ratio: 18 }],
        [{ engagement_pct: 30 }],
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      // 3 auto metrics succeed (2.1.1, 2.2.1, 5.1.3)
      expect(result.summary.autoMetrics).toBe(3);
    });

    it('summary.manualMetrics counts metrics with status MANUAL', async () => {
      const db = makeDb(
        [{ enrollment_pct: 85 }],
        [{ ratio: 18 }],
        [{ engagement_pct: 30 }],
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      // 1 manual metric (2.4.1)
      expect(result.summary.manualMetrics).toBe(1);
    });

    it('summary.errorMetrics counts metrics with status ERROR', async () => {
      const db = makeDb(
        [{ enrollment_pct: 85 }],
        new Error('relation "faculty" does not exist'), // 2.2.1 fails
        [{ engagement_pct: 30 }],
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      expect(result.summary.errorMetrics).toBe(1);
    });

    it('still returns a dashboard when all auto metrics fail (ERROR path)', async () => {
      const db = makeDb(
        new Error('DB down'),
        new Error('DB down'),
        new Error('DB down'),
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      expect(result).toBeDefined();
      expect(result.summary.errorMetrics).toBe(3);
      expect(result.summary.manualMetrics).toBe(1);
    });

    it('still returns a dashboard when DB is null (no DB configured)', async () => {
      const svc = await buildService(null);
      const result = await svc.getDashboard();

      expect(result).toBeDefined();
      expect(result.predictedCgpa).toBeGreaterThanOrEqual(0);
      // All auto metrics should be ERROR; manual metric is MANUAL
      expect(result.summary.errorMetrics).toBe(3);
      expect(result.summary.manualMetrics).toBe(1);
    });

    it('manual metric (2.4.1) contributes 70% estimate to earnedScore', async () => {
      const db = makeDb(
        [{ enrollment_pct: 85 }],
        [{ ratio: 18 }],
        [{ engagement_pct: 30 }],
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      const c2 = result.criteria.find(c => c.id === 'C2')!;
      const manualMetric = c2.metrics.find(m => m.id === '2.4.1')!;

      expect(manualMetric.status).toBe('MANUAL');
      expect(manualMetric.earnedScore).toBe(14); // 70% of 20
    });

    it('failed auto metric (2.2.1) has ERROR status and null earnedScore', async () => {
      const db = makeDb(
        [{ enrollment_pct: 85 }],
        new Error('relation "faculty" does not exist'),
        [{ engagement_pct: 30 }],
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      const c2 = result.criteria.find(c => c.id === 'C2')!;
      const errMetric = c2.metrics.find(m => m.id === '2.2.1')!;

      expect(errMetric.status).toBe('ERROR');
      expect(errMetric.earnedScore).toBeNull();
    });

    it('C5 metric 5.1.3 carries edaiNote in dashboard output', async () => {
      const db = makeDb(
        [{ enrollment_pct: 85 }],
        [{ ratio: 18 }],
        [{ engagement_pct: 30 }],
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      const c5 = result.criteria.find(c => c.id === 'C5')!;
      const metric = c5.metrics.find(m => m.id === '5.1.3')!;
      expect(metric.edaiNote).toContain('Voice calls');
    });

    it('generatedAt is a valid ISO 8601 timestamp', async () => {
      const db = makeDb(
        [{ enrollment_pct: 85 }],
        [{ ratio: 18 }],
        [{ engagement_pct: 30 }],
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      expect(() => new Date(result.generatedAt)).not.toThrow();
      expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
    });

    it('weightedScore for each criterion is ≤ its weightage', async () => {
      const db = makeDb(
        [{ enrollment_pct: 95 }], // max score
        [{ ratio: 15 }],           // max score
        [{ engagement_pct: 60 }],  // max score
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      for (const criterion of result.criteria) {
        expect(criterion.weightedScore).toBeLessThanOrEqual(criterion.weightage);
        expect(criterion.weightedScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('earnedScore for each criterion is ≤ its maxScore', async () => {
      const db = makeDb(
        [{ enrollment_pct: 95 }],
        [{ ratio: 15 }],
        [{ engagement_pct: 60 }],
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      for (const criterion of result.criteria) {
        expect(criterion.earnedScore).toBeLessThanOrEqual(criterion.maxScore);
      }
    });

    it('summary.totalWeightage equals sum of all criteria weightages', async () => {
      const db = makeDb(
        [{ enrollment_pct: 85 }],
        [{ ratio: 18 }],
        [{ engagement_pct: 30 }],
      );
      const svc = await buildService(db);
      const result = await svc.getDashboard();

      // C2 weightage 350 + C5 weightage 130 = 480
      expect(result.summary.totalWeightage).toBe(480);
    });
  });

  // ── NAAC / ERP edge cases ─────────────────────────────────────────────────

  describe('NAAC edge cases', () => {
    it('handles NULL values in DB row without crashing (numericifyRow guards null)', async () => {
      const db = makeDb([{ enrollment_pct: null, ratio: 20 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Enrolment',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT enrollment_pct FROM students',
        scoreFormula: 'enrollment_pct >= 90 ? 20 : 16',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      // null cannot be coerced to a useful number → formula falls back to 70%
      expect(result.status).toBe('OK');
      expect(result.earnedScore).toBeDefined();
    });

    it('handles completely empty-string column value in DB row (numericifyRow guard)', async () => {
      const db = makeDb([{ enrollment_pct: '' }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Enrolment',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT enrollment_pct FROM students',
        scoreFormula: 'enrollment_pct >= 90 ? 20 : 16',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      // Empty string treated as non-numeric, formula falls back
      expect(result.status).toBe('OK');
    });

    it('handles NAAC academic year boundary: student count at exactly 0 (new institution)', async () => {
      const db = makeDb([{ enrollment_pct: 0 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.1.1',
        name: 'Enrolment',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT 0 AS enrollment_pct',
        scoreFormula: 'enrollment_pct >= 90 ? 20 : enrollment_pct >= 80 ? 16 : enrollment_pct >= 70 ? 12 : 8',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      // 0% enrolment falls to lowest tier
      expect(result.earnedScore).toBe(8);
      expect(result.status).toBe('OK');
    });

    it('handles non-integer ratio for student-teacher metric (VTU decimal rounding)', async () => {
      const db = makeDb([{ ratio: 20.0001 }]); // fractionally above 20
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.2.1',
        name: 'Student-Teacher Ratio',
        description: 'desc',
        maxScore: 20,
        dataSource: 'auto',
        sqlQuery: 'SELECT ratio FROM faculty',
        scoreFormula: 'ratio <= 20 ? 20 : ratio <= 25 ? 16 : ratio <= 30 ? 12 : 8',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      // 20.0001 > 20 → drops to second tier
      expect(result.earnedScore).toBe(16);
    });

    it('handles exactly 75% attendance boundary in a custom metric formula', async () => {
      // NAAC may have attendance-related metrics; 75% is the VTU eligibility threshold
      const db = makeDb([{ attendance_pct: 75 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.3.1',
        name: 'Attendance Compliance',
        description: 'Students above 75% attendance',
        maxScore: 10,
        dataSource: 'auto',
        sqlQuery: 'SELECT 75 AS attendance_pct',
        scoreFormula: 'attendance_pct >= 75 ? 10 : attendance_pct >= 65 ? 7 : 4',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.earnedScore).toBe(10); // exactly at boundary → eligible
    });

    it('handles 74.9% attendance (just below VTU detention boundary)', async () => {
      const db = makeDb([{ attendance_pct: 74.9 }]);
      const svc = await buildService(db);
      const metric: MetricConfig = {
        id: '2.3.1',
        name: 'Attendance Compliance',
        description: 'desc',
        maxScore: 10,
        dataSource: 'auto',
        sqlQuery: 'SELECT 74.9 AS attendance_pct',
        scoreFormula: 'attendance_pct >= 75 ? 10 : attendance_pct >= 65 ? 7 : 4',
        evidenceType: 'quantitative',
      };

      const result = await svc.computeMetric(metric);

      expect(result.earnedScore).toBe(7); // below threshold → next tier
    });

    it('concurrent getDashboard() calls do not interfere with each other', async () => {
      const db1 = makeDb(
        [{ enrollment_pct: 85 }],
        [{ ratio: 18 }],
        [{ engagement_pct: 30 }],
      );
      const db2 = makeDb(
        [{ enrollment_pct: 95 }],
        [{ ratio: 15 }],
        [{ engagement_pct: 60 }],
      );
      const svc1 = await buildService(db1);
      const svc2 = await buildService(db2);

      const [r1, r2] = await Promise.all([svc1.getDashboard(), svc2.getDashboard()]);

      // Each instance should compute independently
      expect(r1.predictedCgpa).toBeDefined();
      expect(r2.predictedCgpa).toBeDefined();
      expect(r1.predictedCgpa).not.toBeNaN();
      expect(r2.predictedCgpa).not.toBeNaN();
    });
  });
});
