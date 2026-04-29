import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { KnowledgeGraphService } from './knowledge-graph.service';

const mockChatbotSvc = {
  chatStream: jest.fn(),
  getOrCreateConversation: jest.fn(),
  getSessions: jest.fn(),
  recordConsent: jest.fn(),
  getHistory: jest.fn(),
};

const mockKgSvc = {
  buildStudentGraph: jest.fn(),
  buildParentGraph: jest.fn(),
  buildTeacherGraph: jest.fn(),
};

const studentGraph = {
  role: 'STUDENT',
  name: 'Alice',
  preferredLanguage: 'en',
};

async function buildController(): Promise<ChatbotController> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ChatbotController],
    providers: [
      { provide: ChatbotService, useValue: mockChatbotSvc },
      { provide: KnowledgeGraphService, useValue: mockKgSvc },
    ],
  })
    .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(require('../roles/roles.guard').RolesGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(require('./twilio-webhook.guard').TwilioWebhookGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return module.get<ChatbotController>(ChatbotController);
}

describe('ChatbotController', () => {
  let controller: ChatbotController;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await buildController();
  });

  describe('restChat()', () => {
    it('builds student graph and streams response', async () => {
      mockKgSvc.buildStudentGraph.mockResolvedValue(studentGraph);
      mockChatbotSvc.getOrCreateConversation.mockResolvedValue('conv-1');
      mockChatbotSvc.chatStream.mockImplementation(async (_id, _msg, _g, onChunk) => {
        onChunk('Hello!');
        return 'Hello!';
      });

      const result = await controller.restChat(
        { user: { sub: '1RV21CS001', role: 'STUDENT' } },
        { message: 'Hi' },
      );

      expect(result.message).toBe('Hello!');
      expect(result.conversationId).toBe('conv-1');
      expect(mockKgSvc.buildStudentGraph).toHaveBeenCalledWith('1RV21CS001');
    });

    it('builds teacher graph for FACULTY role', async () => {
      mockKgSvc.buildTeacherGraph.mockResolvedValue({ ...studentGraph, role: 'TEACHER', preferredLanguage: 'en' });
      mockChatbotSvc.getOrCreateConversation.mockResolvedValue('conv-2');
      mockChatbotSvc.chatStream.mockImplementation(async (_id, _msg, _g, onChunk) => {
        onChunk('Your schedule...');
        return 'Your schedule...';
      });

      const result = await controller.restChat(
        { user: { sub: 'FAC001', role: 'FACULTY' } },
        { message: 'Schedule?' },
      );

      expect(result.message).toBe('Your schedule...');
      expect(mockKgSvc.buildTeacherGraph).toHaveBeenCalledWith('FAC001');
    });

    it('builds parent graph for PARENT role', async () => {
      mockKgSvc.buildParentGraph.mockResolvedValue({ ...studentGraph, role: 'PARENT' });
      mockChatbotSvc.getOrCreateConversation.mockResolvedValue('conv-3');
      mockChatbotSvc.chatStream.mockImplementation(async (_id, _msg, _g, onChunk) => {
        onChunk('Your child...');
        return 'Your child...';
      });

      const result = await controller.restChat(
        { user: { sub: '+919845012345', role: 'PARENT' } },
        { message: 'How is she doing?' },
      );

      expect(mockKgSvc.buildParentGraph).toHaveBeenCalledWith('+919845012345');
      expect(result.message).toBe('Your child...');
    });

    it('uses provided conversationId without creating new', async () => {
      mockKgSvc.buildStudentGraph.mockResolvedValue(studentGraph);
      mockChatbotSvc.chatStream.mockResolvedValue('Response');

      await controller.restChat(
        { user: { sub: 'USN001', role: 'STUDENT' } },
        { message: 'Hi', conversationId: 'existing-conv' },
      );

      expect(mockChatbotSvc.getOrCreateConversation).not.toHaveBeenCalled();
    });

    it('throws for unsupported role', async () => {
      await expect(
        controller.restChat(
          { user: { sub: 'ADMIN001', role: 'ADMIN' } },
          { message: 'Hi' },
        ),
      ).rejects.toThrow('Unsupported role');
    });

    it('includes timestamp in response', async () => {
      mockKgSvc.buildStudentGraph.mockResolvedValue(studentGraph);
      mockChatbotSvc.getOrCreateConversation.mockResolvedValue('conv-1');
      mockChatbotSvc.chatStream.mockResolvedValue('OK');

      const result = await controller.restChat(
        { user: { sub: 'USN001', role: 'STUDENT' } },
        { message: 'Hi' },
      );

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('handleWhatsAppMessage()', () => {
    it('handles parent WhatsApp message', async () => {
      mockKgSvc.buildParentGraph.mockResolvedValue({ ...studentGraph, role: 'PARENT' });
      mockChatbotSvc.getOrCreateConversation.mockResolvedValue('conv-wa-1');
      mockChatbotSvc.chatStream.mockResolvedValue('Response');

      const result = await controller.handleWhatsAppMessage(
        { From: 'whatsapp:+919845012345', Body: 'Is Priya present today?' },
        {},
      );

      expect(result.status).toBe('ok');
      expect(mockKgSvc.buildParentGraph).toHaveBeenCalledWith('919845012345');
    });

    it('ignores messages with empty body', async () => {
      const result = await controller.handleWhatsAppMessage(
        { From: 'whatsapp:+919845012345', Body: '' },
        {},
      );
      expect(result.status).toBe('ignored');
    });

    it('ignores messages with no From', async () => {
      const result = await controller.handleWhatsAppMessage(
        { From: '', Body: 'hello' },
        {},
      );
      expect(result.status).toBe('ignored');
    });

    it('falls back to student lookup when parent not found', async () => {
      mockKgSvc.buildParentGraph.mockRejectedValue(new Error('Parent not found'));
      mockKgSvc.buildStudentGraph.mockResolvedValue(studentGraph);
      mockChatbotSvc.getOrCreateConversation.mockResolvedValue('conv-wa-2');
      mockChatbotSvc.chatStream.mockResolvedValue('Response');

      const result = await controller.handleWhatsAppMessage(
        { From: 'whatsapp:+919845012345', Body: 'What is my attendance?' },
        {},
      );

      expect(result.status).toBe('ok');
      expect(mockKgSvc.buildStudentGraph).toHaveBeenCalled();
    });

    it('returns error status on unexpected exception', async () => {
      mockKgSvc.buildParentGraph.mockRejectedValue(new Error('DB down'));
      mockKgSvc.buildStudentGraph.mockRejectedValue(new Error('DB down'));

      const result = await controller.handleWhatsAppMessage(
        { From: 'whatsapp:+919845012345', Body: 'hello' },
        {},
      );

      expect(result.status).toBe('error');
    });
  });

  describe('getSessions()', () => {
    it('delegates to chatbot service', async () => {
      mockChatbotSvc.getSessions.mockResolvedValue([{ id: 'conv-1' }]);
      const result = await controller.getSessions();
      expect(result).toHaveLength(1);
    });
  });

  describe('getDashboard()', () => {
    it('returns dashboard shape', () => {
      const result = controller.getDashboard();
      expect(result).toHaveProperty('totalSessions');
      expect(result).toHaveProperty('topTopics');
    });
  });
});
