import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';

const mockSvc = {
  getDashboard: jest.fn(),
  query: jest.fn(),
  resolve: jest.fn(),
};

describe('ChatbotController', () => {
  let controller: ChatbotController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatbotController],
      providers: [{ provide: ChatbotService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<ChatbotController>(ChatbotController);
  });

  it('getDashboard delegates to service', () => {
    mockSvc.getDashboard.mockReturnValue({ sessions: 0 });
    expect(controller.getDashboard()).toEqual({ sessions: 0 });
  });

  it('query uses sapId from req.user', () => {
    mockSvc.query.mockReturnValue({ reply: 'hi' });
    controller.query({ message: 'hello' }, { user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.query).toHaveBeenCalledWith(undefined, 'hello', 'SAP001');
  });

  it('query falls back to sub when sapId absent', () => {
    mockSvc.query.mockReturnValue({ reply: 'hi' });
    controller.query({ message: 'hello' }, { user: { sub: 'u1' } });
    expect(mockSvc.query).toHaveBeenCalledWith(undefined, 'hello', 'u1');
  });

  it('query falls back to UNKNOWN when no user', () => {
    mockSvc.query.mockReturnValue({ reply: 'hi' });
    controller.query({ message: 'hello' }, {});
    expect(mockSvc.query).toHaveBeenCalledWith(undefined, 'hello', 'UNKNOWN');
  });

  it('resolve delegates sessionId to service', () => {
    mockSvc.resolve.mockReturnValue({ ok: true });
    controller.resolve({ sessionId: 'sess-1' });
    expect(mockSvc.resolve).toHaveBeenCalledWith('sess-1');
  });
});
