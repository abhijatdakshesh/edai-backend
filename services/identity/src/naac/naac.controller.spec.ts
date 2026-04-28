/**
 * naac.controller.spec.ts
 *
 * Unit tests for NaacController.
 * NaacService and NaacSsrService are mocked.  JwtAuthGuard is bypassed.
 * Tests assert delegation contracts and return-value pass-through only —
 * no testing of implementation internals.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NaacController } from './naac.controller';
import { NaacService } from './naac.service';
import { NaacSsrService } from './naac-ssr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// ─── Mock service factories ───────────────────────────────────────────────────

const mockNaacService = {
  getDashboard: jest.fn(),
  getCriterionConfig: jest.fn(),
  getAllCriteria: jest.fn(),
};

const mockSsrService = {
  generateCriterionParagraph: jest.fn(),
  generateFullSsr: jest.fn(),
};

// ─── Helper ───────────────────────────────────────────────────────────────────

async function buildController(): Promise<NaacController> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [NaacController],
    providers: [
      { provide: NaacService, useValue: mockNaacService },
      { provide: NaacSsrService, useValue: mockSsrService },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return module.get<NaacController>(NaacController);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('NaacController', () => {
  let controller: NaacController;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await buildController();
  });

  // ── getDashboard ───────────────────────────────────────────────────────────

  describe('getDashboard()', () => {
    it('delegates to naacService.getDashboard() exactly once', async () => {
      const mockPayload = {
        institution: { name: 'Test College' },
        predictedCgpa: 3.18,
        predictedGrade: 'A',
        generatedAt: new Date().toISOString(),
        criteria: [],
        summary: { totalWeightage: 0, autoMetrics: 0, manualMetrics: 0, errorMetrics: 0 },
      };
      mockNaacService.getDashboard.mockResolvedValue(mockPayload);

      const result = await controller.getDashboard();

      expect(mockNaacService.getDashboard).toHaveBeenCalledTimes(1);
      expect(mockNaacService.getDashboard).toHaveBeenCalledWith();
      expect(result).toBe(mockPayload); // same reference, not a copy
    });

    it('returns the exact object resolved by the service (no wrapping)', async () => {
      const expected = { predictedCgpa: 2.76, predictedGrade: 'B++', criteria: [] };
      mockNaacService.getDashboard.mockResolvedValue(expected);

      const result = await controller.getDashboard();

      expect(result).toStrictEqual(expected);
    });

    it('propagates a service rejection to the caller', async () => {
      mockNaacService.getDashboard.mockRejectedValue(new Error('DB unavailable'));

      await expect(controller.getDashboard()).rejects.toThrow('DB unavailable');
    });
  });

  // ── generateSsrParagraph ───────────────────────────────────────────────────

  describe('generateSsrParagraph()', () => {
    it('delegates to ssrService.generateCriterionParagraph() with the correct criterionId', async () => {
      const mockParagraph = {
        criterionId: 'C2',
        criterionName: 'Teaching-Learning and Evaluation',
        paragraph: 'Test paragraph text.',
        generatedAt: new Date().toISOString(),
      };
      mockSsrService.generateCriterionParagraph.mockResolvedValue(mockParagraph);

      const result = await controller.generateSsrParagraph('C2');

      expect(mockSsrService.generateCriterionParagraph).toHaveBeenCalledTimes(1);
      expect(mockSsrService.generateCriterionParagraph).toHaveBeenCalledWith('C2');
      expect(result).toBe(mockParagraph);
    });

    it('passes any criterion ID string through to the SSR service', async () => {
      mockSsrService.generateCriterionParagraph.mockResolvedValue({});

      await controller.generateSsrParagraph('C7');

      expect(mockSsrService.generateCriterionParagraph).toHaveBeenCalledWith('C7');
    });

    it('passes an unknown criterion ID to the service without validation at controller level', async () => {
      // Validation is the service's responsibility; controller should pass it through
      mockSsrService.generateCriterionParagraph.mockResolvedValue({
        criterionId: 'C99',
        criterionName: 'Unknown',
        paragraph: 'No data found for criterion C99.',
        generatedAt: new Date().toISOString(),
      });

      const result = await controller.generateSsrParagraph('C99') as { criterionId: string };

      expect(mockSsrService.generateCriterionParagraph).toHaveBeenCalledWith('C99');
      expect(result.criterionId).toBe('C99');
    });

    it('propagates a service rejection to the caller', async () => {
      mockSsrService.generateCriterionParagraph.mockRejectedValue(
        new Error('Anthropic API rate limit exceeded'),
      );

      await expect(controller.generateSsrParagraph('C1')).rejects.toThrow(
        'Anthropic API rate limit exceeded',
      );
    });
  });

  // ── generateFullSsr ────────────────────────────────────────────────────────

  describe('generateFullSsr()', () => {
    it('delegates to ssrService.generateFullSsr() exactly once', async () => {
      const mockFull = {
        institutionName: 'Test College',
        predictedCgpa: 3.18,
        predictedGrade: 'A',
        generatedAt: new Date().toISOString(),
        sections: [
          { criterionId: 'C1', criterionName: 'Curricular Aspects', paragraph: 'text1' },
          { criterionId: 'C2', criterionName: 'Teaching-Learning', paragraph: 'text2' },
        ],
      };
      mockSsrService.generateFullSsr.mockResolvedValue(mockFull);

      const result = await controller.generateFullSsr();

      expect(mockSsrService.generateFullSsr).toHaveBeenCalledTimes(1);
      expect(mockSsrService.generateFullSsr).toHaveBeenCalledWith();
      expect(result).toBe(mockFull);
    });

    it('returns an empty sections array when service returns empty sections', async () => {
      const mockEmpty = {
        institutionName: 'Test College',
        predictedCgpa: 0,
        predictedGrade: 'D',
        generatedAt: new Date().toISOString(),
        sections: [],
      };
      mockSsrService.generateFullSsr.mockResolvedValue(mockEmpty);

      const result = await controller.generateFullSsr() as typeof mockEmpty;

      expect(result.sections).toHaveLength(0);
    });

    it('propagates a service rejection to the caller', async () => {
      mockSsrService.generateFullSsr.mockRejectedValue(
        new Error('Anthropic API key not configured'),
      );

      await expect(controller.generateFullSsr()).rejects.toThrow(
        'Anthropic API key not configured',
      );
    });
  });

  // ── Guard wiring verification ──────────────────────────────────────────────

  describe('guard configuration', () => {
    it('controller instantiates successfully with JwtAuthGuard overridden', () => {
      // If JwtAuthGuard were not overridden, module compilation would fail in
      // a test environment lacking Passport strategy registration.
      expect(controller).toBeDefined();
    });
  });
});
