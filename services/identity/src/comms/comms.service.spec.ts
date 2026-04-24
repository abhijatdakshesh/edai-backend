import { Test, TestingModule } from '@nestjs/testing';
import { CommsService, AICallLog, Message } from './comms.service';
import { EventsGateway } from '../events/events.gateway';

const mockEvents = { emitAiCallCompleted: jest.fn() };

const makeCall = (overrides: Partial<AICallLog> = {}): AICallLog => ({
  id: 'call-1',
  calledAt: '2026-04-01T10:00:00Z',
  studentName: 'Alice',
  studentUsn: 'USN001',
  parentId: 'parent-1',
  outcome: 'ANSWERED',
  duration: 120,
  ...overrides,
});

describe('CommsService', () => {
  let service: CommsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommsService,
        { provide: EventsGateway, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<CommsService>(CommsService);
  });

  // ─── getRecentCalls ─────────────────────────────────────────────────────────

  describe('getRecentCalls()', () => {
    it('returns calls in reverse order with default limit 20', () => {
      service.callLogs.push(makeCall({ id: 'c1' }), makeCall({ id: 'c2' }), makeCall({ id: 'c3' }));
      const result = service.getRecentCalls();
      expect(result[0].id).toBe('c3');
      expect(result[1].id).toBe('c2');
      expect(result[2].id).toBe('c1');
    });

    it('respects the limit parameter', () => {
      for (let i = 0; i < 25; i++) {
        service.callLogs.push(makeCall({ id: `c${i}` }));
      }
      expect(service.getRecentCalls(5)).toHaveLength(5);
    });

    it('returns empty array when no calls', () => {
      expect(service.getRecentCalls()).toEqual([]);
    });
  });

  // ─── getParentCalls ─────────────────────────────────────────────────────────

  describe('getParentCalls()', () => {
    it('returns only calls for the given parentId', () => {
      service.callLogs.push(
        makeCall({ id: 'c1', parentId: 'parent-1' }),
        makeCall({ id: 'c2', parentId: 'parent-2' }),
      );
      const result = service.getParentCalls('parent-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });

    it('returns empty array for unknown parentId', () => {
      service.callLogs.push(makeCall({ parentId: 'parent-X' }));
      expect(service.getParentCalls('unknown')).toEqual([]);
    });
  });

  // ─── getParentMessages ──────────────────────────────────────────────────────

  describe('getParentMessages()', () => {
    it('returns messages for the given parentId', () => {
      const msg: Message = {
        id: 'm1',
        parentId: 'parent-1',
        parentName: 'Test Parent',
        studentUsn: 'USN001',
        recipientId: 'teacher-1',
        recipientName: 'Test Teacher',
        subject: 'Test Subject',
        body: 'Hello',
        status: 'SENT',
        replies: [],
        createdAt: '2026-04-01T10:00:00Z',
      };
      service.messages.push(msg, { ...msg, id: 'm2', parentId: 'parent-2' });

      const result = service.getParentMessages('parent-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m1');
    });

    it('returns empty array for unknown parentId', () => {
      expect(service.getParentMessages('nobody')).toEqual([]);
    });
  });

  // ─── getAdminCallLogs ───────────────────────────────────────────────────────

  describe('getAdminCallLogs()', () => {
    it('returns all call logs', () => {
      service.callLogs.push(makeCall({ id: 'c1' }), makeCall({ id: 'c2' }));
      expect(service.getAdminCallLogs()).toHaveLength(2);
    });

    it('returns empty array when no logs', () => {
      expect(service.getAdminCallLogs()).toEqual([]);
    });
  });

  // ─── completeCall ───────────────────────────────────────────────────────────

  describe('completeCall()', () => {
    it('emits ai-call completed event when call log is found', () => {
      service.callLogs.push(makeCall({ id: 'call-1', studentUsn: 'USN001' }));
      service.completeCall('call-1', 'USN001');
      expect(mockEvents.emitAiCallCompleted).toHaveBeenCalledWith({
        callId: 'call-1',
        studentUsn: 'USN001',
      });
    });

    it('does NOT emit when call log is not found', () => {
      service.completeCall('no-such-call', 'USN001');
      expect(mockEvents.emitAiCallCompleted).not.toHaveBeenCalled();
    });
  });
});
