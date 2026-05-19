import { ChatbotService } from './chatbot.service';
import type { StudentKnowledgeGraph } from './knowledge-graph.service';

// ─── Mock Gemini AI ──────────────────────────────────────────────────────────

const mockGenerateContentStream = jest.fn();

jest.mock('../shared/gemini-ai', () => ({
  getGeminiClient: jest.fn(() => ({ models: { generateContentStream: mockGenerateContentStream } })),
  GEMINI_FAST: 'gemini-2.5-flash',
  GEMINI_SMART: 'gemini-2.5-pro',
}));

const mockQuery = jest.fn();
const mockDb = { query: mockQuery } as any;

const studentGraph: StudentKnowledgeGraph = {
  role: 'STUDENT',
  name: 'Alice',
  usn: '1RV21CS001',
  semester: 5,
  section: 'A',
  department: 'CSE',
  parentName: 'Alice Parent',
  preferredLanguage: 'en',
  todaySchedule: [],
  weekSchedule: {},
  attendanceSummary: [{ subject: 'DBMS', present: 40, total: 50, percentage: 80, classesNeededFor75: 0 }],
  overallAttendancePct: 80,
  detentionRisk: false,
  marksSummary: [],
  feeStatus: { totalFee: 85000, paid: 60000, balance: 25000, status: 'PARTIAL', dueDate: null },
  feeBreakdown: [],
  riskScore: 0.3,
  riskLevel: 'LOW',
  recentAbsenceCount: 1,
  announcements: [],
  upcomingPlacements: [],
  vtuWindow: null,
  vtuEligibility: null,
  collegeName: 'RVCE',
  academicYear: '2024-25',
  topicMastery: [],
};

/** Build a mock Gemini stream that yields { text } chunks and (optionally) trailing usageMetadata. */
function makeGeminiStream(chunks: string[], promptTokens = 10, candidatesTokens = 110) {
  async function* streamGen() {
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      yield isLast
        ? { text: chunks[i], usageMetadata: { promptTokenCount: promptTokens, candidatesTokenCount: candidatesTokens } }
        : { text: chunks[i] };
    }
  }
  return Promise.resolve({ [Symbol.asyncIterator]: () => streamGen() });
}

describe('ChatbotService', () => {
  let svc: ChatbotService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new ChatbotService(mockDb);
  });

  describe('selectModel()', () => {
    it('routes attendance query to GEMINI_FAST', () => {
      expect(svc.selectModel('What is my attendance?')).toBe('gemini-2.5-flash');
    });

    it('routes schedule query to GEMINI_FAST', () => {
      expect(svc.selectModel('Show my schedule today')).toBe('gemini-2.5-flash');
    });

    it('routes fee query to GEMINI_FAST', () => {
      expect(svc.selectModel('Is my fee paid?')).toBe('gemini-2.5-flash');
    });

    it('routes complex query to GEMINI_SMART', () => {
      expect(svc.selectModel('Am I at risk of failing this semester?')).toBe('gemini-2.5-pro');
    });

    it('routes general query to GEMINI_SMART', () => {
      expect(svc.selectModel('What should I do to improve my grades?')).toBe('gemini-2.5-pro');
    });
  });

  describe('buildSystemPrompt()', () => {
    it('includes role-specific intro for student', () => {
      const prompt = svc.buildSystemPrompt(studentGraph);
      expect(prompt).toContain('Alice');
      expect(prompt).toContain('1RV21CS001');
      expect(prompt).toContain('STUDENT');
    });

    it('includes knowledge graph JSON', () => {
      const prompt = svc.buildSystemPrompt(studentGraph);
      expect(prompt).toContain('"role": "STUDENT"');
      expect(prompt).toContain('detentionRisk');
    });

    it('includes DPDP-compliant rules', () => {
      const prompt = svc.buildSystemPrompt(studentGraph);
      expect(prompt).toContain('RULES');
      expect(prompt).toContain('Never mention');
    });

    it('builds parent role intro', () => {
      const parentGraph = {
        role: 'PARENT' as const,
        phone: '+91',
        preferredLanguage: 'kn',
        child: { ...studentGraph, role: undefined as any },
        announcements: [],
      };
      const prompt = svc.buildSystemPrompt(parentGraph);
      expect(prompt).toContain('Alice');
      expect(prompt).toContain('Kannada');
    });

    it('builds teacher role intro', () => {
      const teacherGraph = {
        role: 'TEACHER' as const,
        name: 'Dr. Kumar',
        empId: 'FAC001',
        department: 'CSE',
        preferredLanguage: 'en',
        todaySchedule: [],
        weekSchedule: {},
        subjects: [],
        atRiskStudents: [],
        totalStudents: 0,
        announcements: [],
        collegeName: 'RVCE',
      };
      const prompt = svc.buildSystemPrompt(teacherGraph);
      expect(prompt).toContain('Dr. Kumar');
      expect(prompt).toContain('CSE');
    });

    it('falls back to English for unknown language code', () => {
      const graph = { ...studentGraph, preferredLanguage: 'fr' };
      const prompt = svc.buildSystemPrompt(graph);
      expect(prompt).toContain('English');
    });
  });

  describe('chatStream()', () => {
    it('streams chunks and saves to DB', async () => {
      mockQuery
        .mockResolvedValueOnce([])   // history
        .mockResolvedValueOnce([])   // INSERT user message
        .mockResolvedValueOnce([])   // INSERT assistant message
        .mockResolvedValueOnce([]);  // UPDATE last_message_at

      mockGenerateContentStream.mockReturnValueOnce(makeGeminiStream(['Hello ', 'Alice!']));

      const chunks: string[] = [];
      const result = await svc.chatStream('conv-1', 'Hi', studentGraph, (c) => chunks.push(c));

      expect(result).toBe('Hello Alice!');
      expect(chunks).toEqual(['Hello ', 'Alice!']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'ASSISTANT'"),
        expect.arrayContaining(['Hello Alice!']),
      );
    });

    it('returns fallback message when db is null', async () => {
      const svcNoDb = new ChatbotService(null);
      const chunks: string[] = [];
      const result = await svcNoDb.chatStream('conv-1', 'Hi', studentGraph, (c) => chunks.push(c));
      expect(result).toContain('trouble');
    });

    it('handles Gemini API error gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockGenerateContentStream.mockImplementationOnce(() => Promise.reject(new Error('Gemini API down')));

      const chunks: string[] = [];
      const result = await svc.chatStream('conv-1', 'Hi', studentGraph, (c) => chunks.push(c));
      expect(result).toContain('trouble');
    });

    it('uses conversation history from DB with model role', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { role: 'USER', content: 'previous question' },
          { role: 'ASSISTANT', content: 'previous answer' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockGenerateContentStream.mockReturnValueOnce(makeGeminiStream(['OK']));

      await svc.chatStream('conv-1', 'New question', studentGraph, () => {});

      const streamCall = mockGenerateContentStream.mock.calls[0][0];
      expect(streamCall.contents).toHaveLength(3); // 2 history + 1 current
      // Gemini uses 'model' (not 'assistant') for the AI side
      expect(streamCall.contents[1].role).toBe('model');
    });

    it('stores model_used in DB', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockGenerateContentStream.mockReturnValueOnce(makeGeminiStream(['Done']));

      await svc.chatStream('conv-1', 'What is my attendance?', studentGraph, () => {});

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'ASSISTANT'"),
        expect.arrayContaining(['gemini-2.5-flash']),
      );
    });

    it('handles missing usage fields gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Stream yields one text chunk with NO usageMetadata anywhere
      async function* streamGen() {
        yield { text: 'Hi' };
      }
      mockGenerateContentStream.mockReturnValueOnce(
        Promise.resolve({ [Symbol.asyncIterator]: () => streamGen() }),
      );

      const result = await svc.chatStream('conv-1', 'Hello', studentGraph, () => {});
      expect(result).toBe('Hi');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'ASSISTANT'"),
        expect.arrayContaining([0]),
      );
    });
  });

  describe('getOrCreateConversation()', () => {
    it('returns existing active conversation', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 'conv-existing' }]);
      const id = await svc.getOrCreateConversation('USN001', 'STUDENT', 'WEB');
      expect(id).toBe('conv-existing');
    });

    it('creates new conversation when none active', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'conv-new' }]);
      const id = await svc.getOrCreateConversation('USN001', 'STUDENT', 'WEB');
      expect(id).toBe('conv-new');
    });

    it('returns synthetic ephemeral ID when db is null', async () => {
      const svcNoDb = new ChatbotService(null);
      const id = await svcNoDb.getOrCreateConversation('USN001', 'STUDENT', 'WEB');
      expect(id).toMatch(/^eph-USN001-\d+$/);
    });
  });

  describe('recordConsent()', () => {
    it('updates chatbot_consent_at', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await svc.recordConsent('conv-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('chatbot_consent_at'),
        ['conv-1'],
      );
    });

    it('does nothing when db is null', async () => {
      const svcNoDb = new ChatbotService(null);
      await expect(svcNoDb.recordConsent('conv-1')).resolves.toBeUndefined();
    });
  });

  describe('getHistory()', () => {
    it('returns messages from DB', async () => {
      mockQuery.mockResolvedValueOnce([
        { role: 'USER', content: 'hello', createdAt: '2026-04-29' },
        { role: 'ASSISTANT', content: 'hi!', createdAt: '2026-04-29' },
      ]);
      const hist = await svc.getHistory('conv-1', 'user-1');
      expect(hist).toHaveLength(2);
      expect(hist[0].role).toBe('USER');
    });

    it('returns empty array when db is null', async () => {
      const svcNoDb = new ChatbotService(null);
      expect(await svcNoDb.getHistory('conv-1', 'user-1')).toEqual([]);
    });
  });

  describe('getSessions()', () => {
    it('returns sessions from DB', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 'conv-1', user_role: 'STUDENT' }]);
      const sessions = await svc.getSessions();
      expect(sessions).toHaveLength(1);
    });

    it('returns empty array when db is null', async () => {
      const svcNoDb = new ChatbotService(null);
      expect(await svcNoDb.getSessions()).toEqual([]);
    });

    it('returns [] when chat_conversations query rejects (missing table)', async () => {
      // Partially-migrated prod where the table is not yet created.
      // Earlier this 500ed the principal Chat Sessions view.
      mockQuery.mockRejectedValueOnce(new Error('relation "chat_conversations" does not exist'));
      const sessions = await svc.getSessions();
      expect(sessions).toEqual([]);
    });
  });
});
