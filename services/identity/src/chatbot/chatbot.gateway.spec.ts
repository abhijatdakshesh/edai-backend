import { ChatbotGateway } from './chatbot.gateway';
import { ChatbotService } from './chatbot.service';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { JwtService } from '@nestjs/jwt';

const mockJwtSvc = { verify: jest.fn() };
const mockChatbotSvc = {
  getOrCreateConversation: jest.fn(),
  chatStream: jest.fn(),
  getHistory: jest.fn(),
  recordConsent: jest.fn(),
};
const mockKgSvc = {
  buildStudentGraph: jest.fn(),
  buildTeacherGraph: jest.fn(),
  buildParentGraph: jest.fn(),
};

const studentGraph = { role: 'STUDENT', name: 'Alice', preferredLanguage: 'en' };

function makeSocket(userData?: object) {
  return {
    id: 'socket-1',
    handshake: { auth: { token: 'valid-token' }, headers: {} },
    data: userData ? { user: userData } : {},
    disconnect: jest.fn(),
    emit: jest.fn(),
    join: jest.fn(),
  } as any;
}

describe('ChatbotGateway', () => {
  let gateway: ChatbotGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new ChatbotGateway(
      mockJwtSvc as unknown as JwtService,
      mockChatbotSvc as unknown as ChatbotService,
      mockKgSvc as unknown as KnowledgeGraphService,
    );
  });

  describe('handleConnection()', () => {
    it('sets user data on valid token', () => {
      mockJwtSvc.verify.mockReturnValue({ sub: 'USN001', role: 'STUDENT' });
      const socket = makeSocket();
      gateway.handleConnection(socket);
      expect(socket.data.user).toEqual({ sub: 'USN001', role: 'STUDENT' });
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects when no token', () => {
      const socket = { ...makeSocket(), handshake: { auth: {}, headers: {} } };
      gateway.handleConnection(socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects when token invalid', () => {
      mockJwtSvc.verify.mockImplementation(() => { throw new Error('invalid'); });
      const socket = makeSocket();
      gateway.handleConnection(socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect()', () => {
    it('logs without throwing', () => {
      expect(() => gateway.handleDisconnect(makeSocket())).not.toThrow();
    });
  });

  describe('handleMessage()', () => {
    it('streams response for STUDENT role', async () => {
      mockKgSvc.buildStudentGraph.mockResolvedValue(studentGraph);
      mockChatbotSvc.getOrCreateConversation.mockResolvedValue('conv-1');
      mockChatbotSvc.chatStream.mockImplementation(async (_id, _msg, _g, onChunk) => {
        onChunk('Hello!');
        return 'Hello!';
      });

      const socket = makeSocket({ sub: 'USN001', role: 'STUDENT' });
      await gateway.handleMessage({ message: 'Hi' }, socket);

      expect(socket.emit).toHaveBeenCalledWith('chat:typing', expect.objectContaining({ conversationId: 'conv-1' }));
      expect(socket.emit).toHaveBeenCalledWith('chat:chunk', expect.objectContaining({ text: 'Hello!' }));
      expect(socket.emit).toHaveBeenCalledWith('chat:done', expect.objectContaining({ conversationId: 'conv-1' }));
    });

    it('uses existing conversationId when provided', async () => {
      mockKgSvc.buildStudentGraph.mockResolvedValue(studentGraph);
      mockChatbotSvc.chatStream.mockResolvedValue('OK');

      const socket = makeSocket({ sub: 'USN001', role: 'STUDENT' });
      await gateway.handleMessage({ message: 'Hi', conversationId: 'existing-conv' }, socket);

      expect(mockChatbotSvc.getOrCreateConversation).not.toHaveBeenCalled();
    });

    it('emits chat:error for unsupported role', async () => {
      const socket = makeSocket({ sub: 'ADMIN1', role: 'ADMIN' });
      await gateway.handleMessage({ message: 'Hi' }, socket);

      expect(socket.emit).toHaveBeenCalledWith('chat:error', expect.objectContaining({ message: expect.stringContaining('role') }));
    });

    it('emits chat:error when unauthenticated', async () => {
      const socket = makeSocket();
      socket.data = {};
      await gateway.handleMessage({ message: 'Hi' }, socket);

      expect(socket.emit).toHaveBeenCalledWith('chat:error', expect.objectContaining({ message: 'Not authenticated' }));
    });

    it('emits chat:error on graph build failure', async () => {
      mockKgSvc.buildStudentGraph.mockRejectedValue(new Error('DB timeout'));

      const socket = makeSocket({ sub: 'USN001', role: 'STUDENT' });
      await gateway.handleMessage({ message: 'Hi' }, socket);

      expect(socket.emit).toHaveBeenCalledWith('chat:error', expect.any(Object));
    });

    it('routes TEACHER role to buildTeacherGraph', async () => {
      const teacherGraph = { role: 'TEACHER', preferredLanguage: 'en' };
      mockKgSvc.buildTeacherGraph.mockResolvedValue(teacherGraph);
      mockChatbotSvc.getOrCreateConversation.mockResolvedValue('conv-t');
      mockChatbotSvc.chatStream.mockResolvedValue('Schedule...');

      const socket = makeSocket({ sub: 'FAC001', role: 'TEACHER' });
      await gateway.handleMessage({ message: 'Schedule?' }, socket);

      expect(mockKgSvc.buildTeacherGraph).toHaveBeenCalledWith('FAC001');
    });

    it('routes HOD role to buildTeacherGraph', async () => {
      const teacherGraph = { role: 'TEACHER', preferredLanguage: 'kn' };
      mockKgSvc.buildTeacherGraph.mockResolvedValue(teacherGraph);
      mockChatbotSvc.getOrCreateConversation.mockResolvedValue('conv-hod');
      mockChatbotSvc.chatStream.mockResolvedValue('At-risk students...');

      const socket = makeSocket({ sub: 'HOD001', role: 'HOD' });
      await gateway.handleMessage({ message: 'Who are at risk?' }, socket);

      expect(mockKgSvc.buildTeacherGraph).toHaveBeenCalledWith('HOD001');
    });

    it('routes PARENT role to buildParentGraph', async () => {
      const parentGraph = { role: 'PARENT', preferredLanguage: 'kn' };
      mockKgSvc.buildParentGraph.mockResolvedValue(parentGraph);
      mockChatbotSvc.getOrCreateConversation.mockResolvedValue('conv-p');
      mockChatbotSvc.chatStream.mockResolvedValue('ನಿಮ್ಮ ಮಗಳು ಚೆನ್ನಾಗಿದ್ದಾಳೆ');

      const socket = makeSocket({ sub: '+919845012345', role: 'PARENT' });
      await gateway.handleMessage({ message: 'How is she doing?' }, socket);

      expect(mockKgSvc.buildParentGraph).toHaveBeenCalledWith('+919845012345');
      expect(socket.emit).toHaveBeenCalledWith('chat:done', expect.any(Object));
    });
  });

  describe('handleHistory()', () => {
    it('emits chat:history with messages from service', async () => {
      const messages = [{ role: 'USER', content: 'Hi', createdAt: '2026-04-29' }];
      mockChatbotSvc.getHistory.mockResolvedValue(messages);

      const socket = makeSocket({ sub: 'USN001' });
      await gateway.handleHistory({ conversationId: 'conv-1' }, socket);

      expect(socket.emit).toHaveBeenCalledWith('chat:history', messages);
    });

    it('emits chat:error on failure', async () => {
      mockChatbotSvc.getHistory.mockRejectedValue(new Error('DB error'));

      const socket = makeSocket();
      await gateway.handleHistory({ conversationId: 'conv-1' }, socket);

      expect(socket.emit).toHaveBeenCalledWith('chat:error', expect.any(Object));
    });
  });

  describe('handleConsent()', () => {
    it('calls recordConsent and emits ack', async () => {
      mockChatbotSvc.recordConsent.mockResolvedValue(undefined);

      const socket = makeSocket({ sub: 'USN001' });
      await gateway.handleConsent({ conversationId: 'conv-1' }, socket);

      expect(mockChatbotSvc.recordConsent).toHaveBeenCalledWith('conv-1');
      expect(socket.emit).toHaveBeenCalledWith('chat:consent:ack', { ok: true });
    });
  });
});
