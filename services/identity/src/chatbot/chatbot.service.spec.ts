import { ChatbotService } from './chatbot.service';
import type { StudentKnowledgeGraph } from './knowledge-graph.service';

// ─── Mock Claude AI ──────────────────────────────────────────────────────────

const mockMessagesStream = jest.fn();

jest.mock('../shared/claude-ai', () => ({
  getAnthropicClient: jest.fn(() => ({ messages: { stream: mockMessagesStream } })),
  CLAUDE_FAST: 'claude-haiku-4-5-20251001',
  CLAUDE_SMART: 'claude-sonnet-4-6',
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

/** Build a mock Claude stream that yields content_block_delta chunks. */
function makeClaudeStream(chunks: string[], inputTokens = 10, outputTokens = 110) {
  async function* streamGen() {
    for (const text of chunks) {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
    }
  }
  const iter = streamGen();
  return {
    [Symbol.asyncIterator]: () => iter,
    finalMessage: jest.fn().mockResolvedValue({ usage: { input_tokens: inputTokens, output_tokens: outputTokens } }),
  };
}

describe('ChatbotService', () => {
  let svc: ChatbotService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new ChatbotService(mockDb);
  });

  describe('selectModel()', () => {
    it('routes attendance query to CLAUDE_FAST', () => {
      expect(svc.selectModel('What is my attendance?')).toBe('claude-haiku-4-5-20251001');
    });

    it('routes schedule query to CLAUDE_FAST', () => {
      expect(svc.selectModel('Show my schedule today')).toBe('claude-haiku-4-5-20251001');
    });

    it('routes fee query to CLAUDE_FAST', () => {
      expect(svc.selectModel('Is my fee paid?')).toBe('claude-haiku-4-5-20251001');
    });

    it('routes complex query to CLAUDE_SMART', () => {
      expect(svc.selectModel('Am I at risk of failing this semester?')).toBe('claude-sonnet-4-6');
    });

    it('routes general query to CLAUDE_SMART', () => {
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

      mockMessagesStream.mockReturnValueOnce(makeClaudeStream(['Hello ', 'Alice!']));

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

      mockMessagesStream.mockImplementationOnce(() => { throw new Error('Claude API down'); });

      const chunks: string[] = [];
      const result = await svc.chatStream('conv-1', 'Hi', studentGraph, (c) => chunks.push(c));
      expect(result).toContain('trouble');
    });

    it('uses conversation history from DB with assistant role', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { role: 'USER', content: 'previous question' },
          { role: 'ASSISTANT', content: 'previous answer' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockMessagesStream.mockReturnValueOnce(makeClaudeStream(['OK']));

      await svc.chatStream('conv-1', 'New question', studentGraph, () => {});

      const streamCall = mockMessagesStream.mock.calls[0][0];
      expect(streamCall.messages).toHaveLength(3); // 2 history + 1 current
      expect(streamCall.messages[1].role).toBe('assistant');
    });

    it('stores model_used in DB', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockMessagesStream.mockReturnValueOnce(makeClaudeStream(['Done']));

      await svc.chatStream('conv-1', 'What is my attendance?', studentGraph, () => {});

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'ASSISTANT'"),
        expect.arrayContaining(['claude-haiku-4-5-20251001']),
      );
    });

    it('handles missing usage fields gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      async function* streamGen() {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } };
      }
      const iter = streamGen();
      mockMessagesStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: () => iter,
        finalMessage: jest.fn().mockResolvedValue({ usage: { input_tokens: undefined, output_tokens: undefined } }),
      });

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
