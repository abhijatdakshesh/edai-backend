import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from './chatbot.service';

describe('ChatbotService', () => {
  let service: ChatbotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatbotService],
    }).compile();
    service = module.get<ChatbotService>(ChatbotService);
  });

  describe('getDashboard()', () => {
    it('returns dashboard stats', () => {
      const result = service.getDashboard();
      expect(result.totalSessions).toBeGreaterThan(0);
      expect(result.topTopics).toBeInstanceOf(Array);
    });
  });

  describe('query()', () => {
    it('routes attendance message to ATTENDANCE_QUERY intent', () => {
      const result = service.query(undefined, 'What is my attendance?', 'USN001');
      expect(result.intent).toBe('ATTENDANCE_QUERY');
      expect(result.reply).toContain('75%');
    });

    it('routes fee message to FEE_QUERY intent', () => {
      const result = service.query(undefined, 'How do I pay my fee?', 'USN001');
      expect(result.intent).toBe('FEE_QUERY');
    });

    it('routes pay keyword to FEE_QUERY intent', () => {
      const result = service.query(undefined, 'Can I pay online?', 'USN001');
      expect(result.intent).toBe('FEE_QUERY');
    });

    it('routes exam message to EXAM_SCHEDULE intent', () => {
      const result = service.query(undefined, 'When is my exam?', 'USN001');
      expect(result.intent).toBe('EXAM_SCHEDULE');
    });

    it('routes assignment message to ASSIGNMENT_QUERY intent', () => {
      const result = service.query(undefined, 'Show my assignments', 'USN001');
      expect(result.intent).toBe('ASSIGNMENT_QUERY');
    });

    it('defaults to GENERAL_QUERY for unknown messages', () => {
      const result = service.query(undefined, 'Hello there!', 'USN001');
      expect(result.intent).toBe('GENERAL_QUERY');
    });

    it('reuses provided sessionId', () => {
      const result = service.query('sess-123', 'Hello', 'USN001');
      expect(result.sessionId).toBe('sess-123');
    });

    it('generates sessionId when not provided', () => {
      const result = service.query(undefined, 'Hello', 'USN001');
      expect(result.sessionId).toMatch(/^session-/);
    });
  });

  describe('resolve()', () => {
    it('returns ok:true with resolvedAt', () => {
      const result = service.resolve('sess-123');
      expect(result.ok).toBe(true);
      expect(result.resolvedAt).toBeDefined();
    });
  });
});
