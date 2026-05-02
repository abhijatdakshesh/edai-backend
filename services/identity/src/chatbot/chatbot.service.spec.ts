import { ChatbotService } from './chatbot.service';
import type { StudentKnowledgeGraph } from './knowledge-graph.service';

// Mock Gemini streaming
const mockSendMessageStream = jest.fn();
const mockStartChat = jest.fn().mockReturnValue({ sendMessageStream: mockSendMessageStream });
const mockGetGenerativeModel = jest.fn().mockReturnValue({ startChat: mockStartChat });

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
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
};

function makeStreamResult(chunks: string[], totalTokens = 120) {
  async function* streamGen() {
    for (const text of chunks) {
      yield { text: () => text };
    }
  }
  return {
    stream: streamGen(),
    response: Promise.resolve({ usageMetadata: { totalTokenCount: totalTokens } }),
  };
}

describe('ChatbotService', () => {
  let svc: ChatbotService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new ChatbotService(mockDb);
  });

  describe('selectModel()', () => {
    it('routes attendance query to Gemini Flash', () => {
      expect(svc.selectModel('What is my attendance?')).toBe('gemini-2.5-flash-lite');
    });

    it('routes schedule query to Gemini Flash', () => {
      expect(svc.selectModel('Show my schedule today')).toBe('gemini-2.5-flash-lite');
    });

    it('routes fee query to Gemini Flash', () => {
      expect(svc.selectModel('Is my fee paid?')).toBe('gemini-2.5-flash-lite');
    });

    it('routes complex query to Gemini Pro', () => {
      expect(svc.selectModel('Am I at risk of failing this semester?')).toBe('gemini-2.5-flash');
    });

    it('routes general query to Gemini Pro', () => {
      expect(svc.selectModel('What should I do to improve my grades?')).toBe('gemini-2.5-flash');
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
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockSendMessageStream.mockResolvedValue(makeStreamResult(['Hello ', 'Alice!']));

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

      mockSendMessageStream.mockRejectedValue(new Error('Gemini API down'));

      const chunks: string[] = [];
      const result = await svc.chatStream('conv-1', 'Hi', studentGraph, (c) => chunks.push(c));
      expect(result).toContain('trouble');
    });

    it('uses conversation history from DB', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { role: 'USER', content: 'previous question' },
          { role: 'ASSISTANT', content: 'previous answer' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockSendMessageStream.mockResolvedValue(makeStreamResult(['OK']));

      await svc.chatStream('conv-1', 'New question', studentGraph, () => {});

      const startChatCall = mockStartChat.mock.calls[0][0];
      expect(startChatCall.history).toHaveLength(2);
      expect(startChatCall.history[0].role).toBe('user');
      expect(startChatCall.history[1].role).toBe('model');
    });

    it('stores model_used in DB', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockSendMessageStream.mockResolvedValue(makeStreamResult(['Done']));

      await svc.chatStream('conv-1', 'What is my attendance?', studentGraph, () => {});

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'ASSISTANT'"),
        expect.arrayContaining(['gemini-2.5-flash-lite']),
      );
    });

    it('skips empty chunks from Gemini stream', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      async function* streamWithEmpty() {
        yield { text: () => '' };
        yield { text: () => 'Hello' };
        yield { text: () => '' };
      }
      mockSendMessageStream.mockResolvedValue({
        stream: streamWithEmpty(),
        response: Promise.resolve({ usageMetadata: { totalTokenCount: 10 } }),
      });

      const chunks: string[] = [];
      const result = await svc.chatStream('conv-1', 'Hi', studentGraph, (c) => chunks.push(c));
      expect(chunks).toEqual(['Hello']);
      expect(result).toBe('Hello');
    });

    it('handles missing usageMetadata gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      async function* streamGen() { yield { text: () => 'Hi' }; }
      mockSendMessageStream.mockResolvedValue({
        stream: streamGen(),
        response: Promise.resolve({ usageMetadata: undefined }),
      });

      const result = await svc.chatStream('conv-1', 'Hello', studentGraph, () => {});
      expect(result).toBe('Hi');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'ASSISTANT'"),
        expect.arrayContaining([0]),
      );
    });
    it('falls back to next model on retryable 429 error and logs warn (line 162 + 168)', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // First call (primary) → 429 retryable; second call (fallback) → success
      mockSendMessageStream
        .mockRejectedValueOnce(new Error('[429 Too Many Requests] quota exceeded'))
        .mockResolvedValueOnce(makeStreamResult(['Fallback response']));

      const chunks: string[] = [];
      const result = await svc.chatStream('conv-1', 'What is my attendance?', studentGraph, (c) => chunks.push(c));

      // Used the fallback model — line 162 warn branch hit
      expect(result).toBe('Fallback response');
      expect(chunks).toEqual(['Fallback response']);
    });

    it('falls back through full chain and returns error message when all models fail', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // All models in chain fail with retryable errors — line 168 warn + continue hit
      mockSendMessageStream.mockRejectedValue(new Error('[503 Service Unavailable] overloaded'));

      const chunks: string[] = [];
      const result = await svc.chatStream('conv-1', 'Hi', studentGraph, (c) => chunks.push(c));

      expect(result).toContain('trouble');
      expect(chunks[0]).toContain('trouble');
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

    it('throws when db is null', async () => {
      const svcNoDb = new ChatbotService(null);
      await expect(svcNoDb.getOrCreateConversation('USN001', 'STUDENT', 'WEB')).rejects.toThrow('No database');
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
  });
});
