import { ChatbotService } from './chatbot.service';
import type { StudentKnowledgeGraph } from './knowledge-graph.service';

// Mock Anthropic streaming
const mockStream = {
  [Symbol.asyncIterator]: jest.fn(),
  finalMessage: jest.fn(),
};
const mockMessagesStream = jest.fn().mockReturnValue(mockStream);
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { stream: mockMessagesStream },
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
  preferredLanguage: 'en',
  todaySchedule: [],
  attendanceSummary: [{ subject: 'DBMS', present: 40, total: 50, percentage: 80, classesNeededFor75: 0 }],
  overallAttendancePct: 80,
  detentionRisk: false,
  marksSummary: [],
  feeStatus: { totalFee: 85000, paid: 60000, balance: 25000, status: 'PARTIAL', dueDate: null },
  riskScore: 0.3,
  riskLevel: 'LOW',
  recentAbsenceCount: 1,
};

function makeAsyncIterator(chunks: string[]) {
  const events = chunks.map(text => ({
    type: 'content_block_delta',
    delta: { type: 'text_delta', text },
  }));
  let i = 0;
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => i < events.length
          ? { value: events[i++], done: false }
          : { value: undefined, done: true },
      };
    },
  };
}

describe('ChatbotService', () => {
  let svc: ChatbotService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new ChatbotService(mockDb);
  });

  describe('selectModel()', () => {
    it('routes attendance query to Haiku', () => {
      expect(svc.selectModel('What is my attendance?')).toBe('claude-haiku-4-5-20251001');
    });

    it('routes schedule query to Haiku', () => {
      expect(svc.selectModel('Show my schedule today')).toBe('claude-haiku-4-5-20251001');
    });

    it('routes fee query to Haiku', () => {
      expect(svc.selectModel('Is my fee paid?')).toBe('claude-haiku-4-5-20251001');
    });

    it('routes complex query to Sonnet', () => {
      expect(svc.selectModel('Am I at risk of failing this semester?')).toBe('claude-sonnet-4-6');
    });

    it('routes general query to Sonnet', () => {
      expect(svc.selectModel('What should I do to improve my grades?')).toBe('claude-sonnet-4-6');
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
        subjects: [],
        atRiskStudents: [],
        totalStudents: 0,
      };
      const prompt = svc.buildSystemPrompt(teacherGraph);
      expect(prompt).toContain('Dr. Kumar');
      expect(prompt).toContain('CSE');
    });
  });

  describe('chatStream()', () => {
    it('streams chunks and saves to DB', async () => {
      mockQuery
        .mockResolvedValueOnce([])   // history
        .mockResolvedValueOnce([])   // save user message
        .mockResolvedValueOnce([])   // save assistant message
        .mockResolvedValueOnce([]);  // update last_message_at

      const iter = makeAsyncIterator(['Hello ', 'Alice!']);
      (mockStream as any)[Symbol.asyncIterator] = () => iter[Symbol.asyncIterator]();
      mockStream.finalMessage.mockResolvedValue({
        usage: { input_tokens: 100, output_tokens: 20 },
      });

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

    it('handles Claude API error gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (mockStream as any)[Symbol.asyncIterator] = () => ({
        [Symbol.asyncIterator]() { return this; },
        next: async () => { throw new Error('Claude API down'); },
      });

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

      const iter = makeAsyncIterator(['OK']);
      (mockStream as any)[Symbol.asyncIterator] = () => iter[Symbol.asyncIterator]();
      mockStream.finalMessage.mockResolvedValue({ usage: { input_tokens: 50, output_tokens: 5 } });

      await svc.chatStream('conv-1', 'New question', studentGraph, () => {});

      // Verify Claude was called with history included
      const streamCall = mockMessagesStream.mock.calls[0][0];
      expect(streamCall.messages.length).toBe(3); // 2 history + 1 new
      expect(streamCall.messages[0].content).toBe('previous question');
    });

    it('stores model_used in DB', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const iter = makeAsyncIterator(['Done']);
      (mockStream as any)[Symbol.asyncIterator] = () => iter[Symbol.asyncIterator]();
      mockStream.finalMessage.mockResolvedValue({ usage: { input_tokens: 10, output_tokens: 5 } });

      await svc.chatStream('conv-1', 'What is my attendance?', studentGraph, () => {});

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'ASSISTANT'"),
        expect.arrayContaining(['claude-haiku-4-5-20251001']),
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
        .mockResolvedValueOnce([])                  // no existing
        .mockResolvedValueOnce([])                  // deactivate stale
        .mockResolvedValueOnce([{ id: 'conv-new' }]); // insert
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
      const hist = await svc.getHistory('conv-1');
      expect(hist).toHaveLength(2);
      expect(hist[0].role).toBe('USER');
    });

    it('returns empty array when db is null', async () => {
      const svcNoDb = new ChatbotService(null);
      expect(await svcNoDb.getHistory('conv-1')).toEqual([]);
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

  // --- Branch coverage: getLang() fallback (line 39 — unknown language code hits ?? 'English') ---
  describe('buildSystemPrompt() — unknown language fallback', () => {
    it('falls back to English for unrecognised language code', () => {
      const graphWithUnknownLang: StudentKnowledgeGraph = {
        ...studentGraph,
        preferredLanguage: 'fr',  // not in LANGUAGE_NAMES map → ?? 'English' branch
      };
      const prompt = svc.buildSystemPrompt(graphWithUnknownLang);
      // The prompt must declare English as the response language
      expect(prompt).toContain('English');
    });

    it('resolves Kannada for kn language code', () => {
      const graphKn: StudentKnowledgeGraph = { ...studentGraph, preferredLanguage: 'kn' };
      const prompt = svc.buildSystemPrompt(graphKn);
      expect(prompt).toContain('Kannada');
    });

    it('resolves Tamil for ta language code', () => {
      const graphTa: StudentKnowledgeGraph = { ...studentGraph, preferredLanguage: 'ta' };
      const prompt = svc.buildSystemPrompt(graphTa);
      expect(prompt).toContain('Tamil');
    });

    it('resolves Telugu for te language code', () => {
      const graphTe: StudentKnowledgeGraph = { ...studentGraph, preferredLanguage: 'te' };
      const prompt = svc.buildSystemPrompt(graphTe);
      expect(prompt).toContain('Telugu');
    });

    it('resolves Hindi for hi language code', () => {
      const graphHi: StudentKnowledgeGraph = { ...studentGraph, preferredLanguage: 'hi' };
      const prompt = svc.buildSystemPrompt(graphHi);
      expect(prompt).toContain('Hindi');
    });
  });
});
