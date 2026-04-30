import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { PlacementResumeService } from './placement-resume.service';
import { PlacementScoreService } from './placement-score.service';

// ---------------------------------------------------------------------------
// Mock @anthropic-ai/sdk
// ---------------------------------------------------------------------------

const mockAnthropicCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

// ---------------------------------------------------------------------------
// Mock PDFKit — we test PDF pipeline integration, but skip real rendering
// ---------------------------------------------------------------------------

const mockDocOn = jest.fn();
const mockDocEnd = jest.fn();
const mockDocText = jest.fn().mockReturnThis();
const mockDocFontSize = jest.fn().mockReturnThis();
const mockDocFont = jest.fn().mockReturnThis();
const mockDocFillColor = jest.fn().mockReturnThis();
const mockDocMoveDown = jest.fn().mockReturnThis();
const mockDocMoveTo = jest.fn().mockReturnThis();
const mockDocLineTo = jest.fn().mockReturnThis();
const mockDocStrokeColor = jest.fn().mockReturnThis();
const mockDocLineWidth = jest.fn().mockReturnThis();
const mockDocStroke = jest.fn().mockReturnThis();

// Simulate PDFDocument emitting 'data' and 'end' to resolve the promise
function makeMockPDFDoc() {
  const callbacks: Record<string, ((...args: unknown[]) => void)[]> = {};
  const doc = {
    on: (event: string, cb: (...args: unknown[]) => void) => {
      callbacks[event] = callbacks[event] ?? [];
      callbacks[event].push(cb);
    },
    end: () => {
      // emit data then end
      (callbacks['data'] ?? []).forEach((cb) => cb(Buffer.from('fake-pdf-chunk')));
      (callbacks['end'] ?? []).forEach((cb) => cb());
    },
    fontSize: mockDocFontSize,
    font: mockDocFont,
    text: mockDocText,
    fillColor: mockDocFillColor,
    moveDown: mockDocMoveDown,
    moveTo: mockDocMoveTo,
    lineTo: mockDocLineTo,
    strokeColor: mockDocStrokeColor,
    lineWidth: mockDocLineWidth,
    stroke: mockDocStroke,
    y: 100,
  };
  return doc;
}

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => makeMockPDFDoc());
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PROFILE = {
  usn: '1RV21CS001',
  name: 'Alice Sharma',
  department: 'CSE',
  semester: 8,
  section: 'A',
  cgpa: 8.5,
  attendancePct: 85,
  backlogs: 0,
  readinessScore: 78,
  placementStatus: 'PLACEMENT_READY' as const,
  subjects: [
    { name: 'Operating Systems', ia1: 18, ia2: 19, ia3: null, max: 20 },
    { name: 'DBMS', ia1: 16, ia2: 17, ia3: 18, max: 20 },
  ],
  scoreBreakdown: { cgpaPts: 28, attendancePts: 18, backlogPts: 20, trendPts: 5, semesterPts: 10 },
};

const PROFILE_NO_SUBJECTS = { ...MOCK_PROFILE, subjects: [] };

function anthropicTextResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

function anthropicNonTextResponse() {
  return { content: [{ type: 'image', source: {} }] };
}

const RESUME_TEXT = `OBJECTIVE
Seeking a role in technology.\n\nEDUCATION\nBE in CSE — CGPA 8.5/10\n\nTECHNICAL SKILLS\nJava, Python`;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PlacementResumeService', () => {
  let service: PlacementResumeService;
  let scoreService: jest.Mocked<PlacementScoreService>;
  let mockDbQuery: jest.Mock;

  async function buildModule(queryImpl: jest.Mock) {
    mockDbQuery = queryImpl;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacementResumeService,
        {
          provide: PlacementScoreService,
          useValue: scoreService,
        },
        {
          provide: getDataSourceToken(),
          useValue: { query: queryImpl },
        },
      ],
    }).compile();
    service = module.get<PlacementResumeService>(PlacementResumeService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    scoreService = {
      getStudentProfile: jest.fn(),
    } as unknown as jest.Mocked<PlacementScoreService>;
  });

  // ── Happy path — Claude returns text ─────────────────────────────────────

  describe('generateResume() — Claude success path', () => {
    it('returns a Buffer (PDF) when Claude provides resume text', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest
        .fn()
        .mockResolvedValueOnce([{ phone: '+919876543210', email: 'alice@test.com' }]) // student contact
        .mockResolvedValueOnce([]);  // INSERT resume

      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));

      await buildModule(query);
      const result = await service.generateResume('1RV21CS001', 'PRODUCT');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('calls Claude with PRODUCT company context', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      mockDbQuery = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(mockDbQuery);

      await service.generateResume('1RV21CS001', 'PRODUCT');

      const callArgs = mockAnthropicCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
      expect(callArgs.messages[0].content).toContain('product-based tech company');
      expect(callArgs.messages[0].content).toContain('DSA, system design');
    });

    it('calls Claude with SERVICE company context', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      mockDbQuery = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(mockDbQuery);

      await service.generateResume('1RV21CS001', 'SERVICE');

      const callArgs = mockAnthropicCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
      expect(callArgs.messages[0].content).toContain('service-based IT company');
    });

    it('calls Claude with STARTUP company context', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      mockDbQuery = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(mockDbQuery);

      await service.generateResume('1RV21CS001', 'STARTUP');

      const callArgs = mockAnthropicCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
      expect(callArgs.messages[0].content).toContain('startup');
    });

    it('calls Claude with CORE company context', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      mockDbQuery = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(mockDbQuery);

      await service.generateResume('1RV21CS001', 'CORE');

      const callArgs = mockAnthropicCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
      expect(callArgs.messages[0].content).toContain('core engineering company');
    });

    it('includes student CGPA, attendance, and backlogs in the Claude prompt', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      mockDbQuery = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(mockDbQuery);

      await service.generateResume('1RV21CS001', 'PRODUCT');

      const callArgs = mockAnthropicCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
      expect(callArgs.messages[0].content).toContain('8.5/10');
      expect(callArgs.messages[0].content).toContain('85%');
      expect(callArgs.messages[0].content).toContain('Backlogs: 0');
    });

    it('includes subject performance with ia3 null displayed as N/A', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      mockDbQuery = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(mockDbQuery);

      await service.generateResume('1RV21CS001', 'PRODUCT');

      const callArgs = mockAnthropicCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
      // Operating Systems has ia3=null → should show N/A
      expect(callArgs.messages[0].content).toContain('IA3=N/A');
    });

    it('shows N/A for ia1 and ia2 when they are null (covers ?? N/A branches for all three marks)', async () => {
      // Profile with a subject where ia1 and ia2 are also null — covers the ?? 'N/A' branch
      // for ia1 and ia2 on line 31 of placement-resume.service.ts
      const profileWithNullMarks = {
        ...MOCK_PROFILE,
        subjects: [{ name: 'Mathematics', ia1: null, ia2: null, ia3: null, max: 20 }],
      };
      scoreService.getStudentProfile.mockResolvedValue(profileWithNullMarks);
      mockDbQuery = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(mockDbQuery);

      await service.generateResume('1RV21CS001', 'SERVICE');

      const callArgs = mockAnthropicCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
      expect(callArgs.messages[0].content).toContain('IA1=N/A');
      expect(callArgs.messages[0].content).toContain('IA2=N/A');
      expect(callArgs.messages[0].content).toContain('IA3=N/A');
    });

    it('inserts resume text to DB after generation', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest
        .fn()
        .mockResolvedValueOnce([{ phone: '+919876543210', email: 'alice@test.com' }])
        .mockResolvedValueOnce([]);

      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(query);

      await service.generateResume('1RV21CS001', 'PRODUCT');

      const [insertSql, insertParams] = query.mock.calls[1] as [string, unknown[]];
      expect(insertSql).toContain('INSERT INTO placement_resumes');
      expect(insertParams).toContain('1RV21CS001');
      expect(insertParams).toContain('PRODUCT');
      expect(insertParams).toContain(RESUME_TEXT);
    });

    it('uses fallback email (USN-based) when student has no email in DB', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest
        .fn()
        .mockResolvedValueOnce([{}])  // contact row with no email/phone
        .mockResolvedValueOnce([]);

      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(query);

      const result = await service.generateResume('1RV21CS001', 'SERVICE');
      // PDF should be generated without throwing despite missing contact fields
      expect(result).toBeInstanceOf(Buffer);
    });

    it('uses empty string for phone when student has no phone in DB', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest
        .fn()
        .mockResolvedValueOnce([{ email: 'alice@test.com' }])  // no phone field
        .mockResolvedValueOnce([]);

      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(query);

      const result = await service.generateResume('1RV21CS001', 'SERVICE');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('handles student with empty subjects array without crashing', async () => {
      scoreService.getStudentProfile.mockResolvedValue(PROFILE_NO_SUBJECTS);
      const query = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(query);

      const result = await service.generateResume('1RV21CS001', 'CORE');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('no student contact row returns empty contact without crashing', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest
        .fn()
        .mockResolvedValueOnce([])   // no student row in DB
        .mockResolvedValueOnce([]);

      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(RESUME_TEXT));
      await buildModule(query);

      const result = await service.generateResume('1RV21CS001', 'STARTUP');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('returns empty resumeText when Claude returns non-text content type', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValueOnce(anthropicNonTextResponse());
      await buildModule(query);

      // Should not throw — empty string passed to PDF builder
      const result = await service.generateResume('1RV21CS001', 'SERVICE');
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  // ── Claude error fallback path ────────────────────────────────────────────

  describe('generateResume() — Claude error fallback', () => {
    it('falls back to minimal resume text when Claude throws', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest
        .fn()
        .mockResolvedValueOnce([{ phone: '+919876543210', email: 'alice@test.com' }])
        .mockResolvedValueOnce([]);

      mockAnthropicCreate.mockRejectedValueOnce(new Error('overloaded'));
      await buildModule(query);

      const result = await service.generateResume('1RV21CS001', 'PRODUCT');

      // Must still produce a PDF
      expect(result).toBeInstanceOf(Buffer);

      // The fallback resume text is inserted to DB
      const insertParams = query.mock.calls[1][1] as unknown[];
      const savedText = String(insertParams[2]);
      expect(savedText).toContain('OBJECTIVE');
      expect(savedText).toContain('EDUCATION');
      expect(savedText).toContain('8.5/10');
    });

    it('fallback text mentions the companyType in lowercase', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockRejectedValueOnce(new Error('timeout'));
      await buildModule(query);

      await service.generateResume('1RV21CS001', 'STARTUP');

      const insertParams = query.mock.calls[1][1] as unknown[];
      const savedText = String(insertParams[2]);
      expect(savedText).toContain('startup');
    });

    it('fallback text includes department name', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest.fn().mockResolvedValue([]);
      mockAnthropicCreate.mockRejectedValueOnce(new Error('quota exceeded'));
      await buildModule(query);

      await service.generateResume('1RV21CS001', 'CORE');

      const insertParams = query.mock.calls[1][1] as unknown[];
      const savedText = String(insertParams[2]);
      expect(savedText).toContain('CSE');
    });
  });

  // ── buildResumePDF PDF section header detection ───────────────────────────

  describe('buildResumePDF() — section header formatting', () => {
    it('treats uppercase lines as section headers (bold blue rendering path)', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest.fn().mockResolvedValue([]);
      // Resume with uppercase section header and a normal line
      const resumeWithSections = 'TECHNICAL SKILLS\nJava, Python, SQL';
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(resumeWithSections));
      await buildModule(query);

      const result = await service.generateResume('1RV21CS001', 'PRODUCT');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('handles blank lines in resume text (moveDown path)', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest.fn().mockResolvedValue([]);
      const resumeWithBlanks = 'EDUCATION\n\nBE in CSE\n\nOBJECTIVE';
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(resumeWithBlanks));
      await buildModule(query);

      const result = await service.generateResume('1RV21CS001', 'PRODUCT');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('treats lines with parentheses as body text, not headers', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const query = jest.fn().mockResolvedValue([]);
      // Line is uppercase but has parenthesis — should NOT be treated as header
      const resumeWithParenLine = 'BE IN CSE (2021-2025)\nSome achievement';
      mockAnthropicCreate.mockResolvedValueOnce(anthropicTextResponse(resumeWithParenLine));
      await buildModule(query);

      const result = await service.generateResume('1RV21CS001', 'PRODUCT');
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
