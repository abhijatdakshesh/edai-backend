import { Test, TestingModule } from '@nestjs/testing';
import { NaacSsrService } from './naac-ssr.service';
import { NaacService, CriterionResult, NaacDashboard } from './naac.service';

// ─── Mock Anthropic SDK ──────────────────────────────────────────────────────

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeMetric = (
  id: string,
  overrides: Partial<CriterionResult['metrics'][0]> = {},
): CriterionResult['metrics'][0] => ({
  id,
  name: `Metric ${id}`,
  description: 'Test metric',
  maxScore: 20,
  earnedScore: 16,
  dataSource: 'auto',
  status: 'OK',
  liveData: { count: 100, pct: 80 },
  evidenceType: 'quantitative',
  ...overrides,
});

const makeCriterion = (
  id: string,
  overrides: Partial<CriterionResult> = {},
): CriterionResult => ({
  id,
  name: `Criterion ${id}`,
  weightage: 100,
  maxScore: 40,
  earnedScore: 32,
  weightedScore: 80,
  metrics: [makeMetric(`${id}.1`), makeMetric(`${id}.2`, { liveData: null, edaiNote: 'EdAI evidence note' })],
  ...overrides,
});

const makeDashboard = (criteria: CriterionResult[] = []): NaacDashboard => ({
  institution: {
    name: 'RV Institute of Technology',
    shortName: 'RVIT',
    affiliation: 'VTU',
    city: 'Bengaluru',
    state: 'Karnataka',
    type: 'Engineering College',
    naacGradeThresholds: { 'A++': 3.51, 'A+': 3.26, 'A': 3.01, 'B++': 2.76, 'B+': 2.51, 'B': 2.01, 'C': 1.51 },
  },
  predictedCgpa: 3.18,
  predictedGrade: 'A',
  generatedAt: new Date().toISOString(),
  criteria,
  summary: { totalWeightage: 100, autoMetrics: 2, manualMetrics: 0, errorMetrics: 0 },
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NaacSsrService', () => {
  let service: NaacSsrService;
  let mockNaacService: { getDashboard: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNaacService = { getDashboard: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NaacSsrService,
        { provide: NaacService, useValue: mockNaacService },
        { provide: 'DataSource', useValue: null },
      ],
    }).compile();

    service = module.get<NaacSsrService>(NaacSsrService);
  });

  // ── generateCriterionParagraph ─────────────────────────────────────────────

  describe('generateCriterionParagraph()', () => {
    it('returns paragraph with criterionId, criterionName, and generatedAt on success', async () => {
      const criterion = makeCriterion('C2');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'This is the SSR paragraph for C2.' }],
      });

      const result = await service.generateCriterionParagraph('C2');

      expect(result.criterionId).toBe('C2');
      expect(result.criterionName).toBe('Criterion C2');
      expect(result.paragraph).toBe('This is the SSR paragraph for C2.');
      expect(result.generatedAt).toBeTruthy();
    });

    it('returns fallback paragraph when criterion is not found in dashboard', async () => {
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([makeCriterion('C1')]));

      const result = await service.generateCriterionParagraph('C99');

      expect(result.criterionId).toBe('C99');
      expect(result.criterionName).toBe('Unknown');
      expect(result.paragraph).toContain('No data found for criterion C99');
    });

    it('returns fallback paragraph when Claude API throws', async () => {
      const criterion = makeCriterion('C2');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockRejectedValue(new Error('Anthropic API unavailable'));

      const result = await service.generateCriterionParagraph('C2');

      expect(result.paragraph).toContain('Criterion C2');
      expect(result.paragraph).toContain('32');
    });

    it('returns fallback paragraph when Claude returns empty content array', async () => {
      const criterion = makeCriterion('C2');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({ content: [] });

      const result = await service.generateCriterionParagraph('C2');

      expect(result.paragraph).toBeTruthy();
      expect(result.paragraph.length).toBeGreaterThan(0);
    });

    it('returns fallback paragraph when Claude returns non-text content type', async () => {
      const criterion = makeCriterion('C2');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({ content: [{ type: 'image', source: {} }] });

      const result = await service.generateCriterionParagraph('C2');

      expect(result.paragraph).toBeTruthy();
    });

    it('trims whitespace from Claude response', async () => {
      const criterion = makeCriterion('C2');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '  \n  Paragraph text here.  \n  ' }],
      });

      const result = await service.generateCriterionParagraph('C2');

      expect(result.paragraph).toBe('Paragraph text here.');
    });

    it('returns fallback when Claude throws a non-Error value (string throw)', async () => {
      const criterion = makeCriterion('C2');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockRejectedValue('rate_limit_exceeded');

      const result = await service.generateCriterionParagraph('C2');

      expect(result.paragraph).toBeTruthy();
    });
  });

  // ── generateFullSsr ────────────────────────────────────────────────────────

  describe('generateFullSsr()', () => {
    it('returns one section per criterion in the dashboard', async () => {
      const criteria = ['C1', 'C2', 'C3'].map(id => makeCriterion(id));
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard(criteria));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'SSR text.' }] });

      const result = await service.generateFullSsr();

      expect(result.sections).toHaveLength(3);
      expect(result.sections.map(s => s.criterionId)).toEqual(['C1', 'C2', 'C3']);
    });

    it('includes institution name, CGPA, and grade from dashboard in response', async () => {
      const criteria = [makeCriterion('C1')];
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard(criteria));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'SSR text.' }] });

      const result = await service.generateFullSsr();

      expect(result.institutionName).toBe('RV Institute of Technology');
      expect(result.predictedCgpa).toBe(3.18);
      expect(result.predictedGrade).toBe('A');
      expect(result.generatedAt).toBeTruthy();
    });

    it('returns empty sections array when dashboard has no criteria', async () => {
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([]));

      const result = await service.generateFullSsr();

      expect(result.sections).toHaveLength(0);
    });

    it('uses fallback paragraph for a criterion when Claude fails mid-loop', async () => {
      const criteria = ['C1', 'C2'].map(id => makeCriterion(id));
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard(criteria));
      // C1 succeeds, C2 fails
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'C1 paragraph.' }] })
        .mockRejectedValueOnce(new Error('rate limit'));

      const result = await service.generateFullSsr();

      expect(result.sections[0].paragraph).toBe('C1 paragraph.');
      expect(result.sections[1].paragraph).toContain('Criterion C2');
    });

    it('generates paragraphs sequentially (one Claude call per criterion)', async () => {
      const criteria = ['C1', 'C2', 'C3'].map(id => makeCriterion(id));
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard(criteria));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'text.' }] });

      await service.generateFullSsr();

      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  // ── buildPrompt ────────────────────────────────────────────────────────────

  describe('buildPrompt() — via callClaude', () => {
    it('includes criterion name and institution in the prompt sent to Claude', async () => {
      const criterion = makeCriterion('C2');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      await service.generateCriterionParagraph('C2');

      const promptSent: string = mockCreate.mock.calls[0][0].messages[0].content;
      expect(promptSent).toContain('RV Institute of Technology');
      expect(promptSent).toContain('VTU');
      expect(promptSent).toContain('C2');
      expect(promptSent).toContain('Criterion C2');
    });

    it('includes liveData in prompt when metric has liveData', async () => {
      const criterion = makeCriterion('C2', {
        metrics: [makeMetric('2.1.1', { liveData: { enrolled: 412, pct: 85.8 } })],
      });
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      await service.generateCriterionParagraph('C2');

      const promptSent: string = mockCreate.mock.calls[0][0].messages[0].content;
      expect(promptSent).toContain('412');
    });

    it('omits liveData section when metric has null liveData', async () => {
      const criterion = makeCriterion('C2', {
        metrics: [makeMetric('2.4.1', { liveData: null, dataSource: 'manual', status: 'MANUAL' })],
      });
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      await service.generateCriterionParagraph('C2');

      const promptSent: string = mockCreate.mock.calls[0][0].messages[0].content;
      expect(promptSent).not.toContain('Live Data:');
    });

    it('includes edaiNote in prompt when metric has edaiNote', async () => {
      const criterion = makeCriterion('C6', {
        metrics: [makeMetric('6.2.2', { edaiNote: 'EdAI counts as e-governance evidence' })],
      });
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      await service.generateCriterionParagraph('C6');

      const promptSent: string = mockCreate.mock.calls[0][0].messages[0].content;
      expect(promptSent).toContain('EdAI counts as e-governance evidence');
    });

    it('uses known NAAC context description for recognised criterion IDs (C1–C7)', async () => {
      for (const cId of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']) {
        jest.clearAllMocks();
        const criterion = makeCriterion(cId);
        mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
        mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

        await service.generateCriterionParagraph(cId);

        const promptSent: string = mockCreate.mock.calls[0][0].messages[0].content;
        // All known criteria have a non-empty context string
        expect(promptSent.length).toBeGreaterThan(200);
      }
    });

    it('gracefully handles unknown criterion ID with empty context string', async () => {
      const criterion = makeCriterion('C99');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      // Should not throw
      await expect(service.generateCriterionParagraph('C99')).resolves.toBeDefined();
    });

    it('shows "pending manual entry" in prompt when metric earnedScore is null', async () => {
      const criterion = makeCriterion('C2', {
        metrics: [makeMetric('2.1.1', { earnedScore: null as unknown as number })],
      });
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      await service.generateCriterionParagraph('C2');

      const promptSent: string = mockCreate.mock.calls[0][0].messages[0].content;
      expect(promptSent).toContain('pending manual entry');
    });
  });

  // ── fallbackParagraph ──────────────────────────────────────────────────────

  describe('fallbackParagraph() — via API failure', () => {
    it('includes criterion name in fallback text', async () => {
      const criterion = makeCriterion('C5');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockRejectedValue(new Error('API down'));

      const result = await service.generateCriterionParagraph('C5');

      expect(result.paragraph).toContain('Criterion C5');
    });

    it('includes earnedScore and maxScore in fallback text', async () => {
      const criterion = makeCriterion('C5', { earnedScore: 28, maxScore: 40 });
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockRejectedValue(new Error('API down'));

      const result = await service.generateCriterionParagraph('C5');

      expect(result.paragraph).toContain('28');
      expect(result.paragraph).toContain('40');
    });

    it('fallback mentions NAAC quality indicators', async () => {
      const criterion = makeCriterion('C1');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockRejectedValue(new Error('API down'));

      const result = await service.generateCriterionParagraph('C1');

      expect(result.paragraph.toLowerCase()).toContain('naac');
    });
  });

  // ── Claude model and token configuration ───────────────────────────────────

  describe('Claude API configuration', () => {
    it('uses claude-sonnet-4-6 model', async () => {
      const criterion = makeCriterion('C2');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      await service.generateCriterionParagraph('C2');

      expect(mockCreate.mock.calls[0][0].model).toBe('claude-sonnet-4-6');
    });

    it('sets max_tokens to 600', async () => {
      const criterion = makeCriterion('C2');
      mockNaacService.getDashboard.mockResolvedValue(makeDashboard([criterion]));
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      await service.generateCriterionParagraph('C2');

      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(600);
    });
  });
});
