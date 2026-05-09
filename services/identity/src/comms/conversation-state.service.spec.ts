import { ConversationStateService } from './conversation-state.service';

describe('ConversationStateService', () => {
  let svc: ConversationStateService;

  beforeEach(() => {
    svc = new ConversationStateService();
  });

  it('init() creates a state with empty turns', () => {
    const s = svc.init('call-1', {
      usn: 'USN1', language: 'kn', callType: 'ABSENT_CALL', institutionId: 'rvce',
    });
    expect(s.turns).toEqual([]);
    expect(s.startedAt).toBeGreaterThan(0);
    expect(svc.get('call-1')).toBe(s);
  });

  it('pushTurn() appends in order with incrementing turn idx', () => {
    svc.init('c2', { usn: 'U', language: 'en', callType: 'ABSENT_CALL', institutionId: 'rvce' });
    const t0 = svc.pushTurn('c2', 'AI', 'hello', 'en');
    const t1 = svc.pushTurn('c2', 'PARENT', 'hi', 'en');
    expect(t0?.turn).toBe(0);
    expect(t1?.turn).toBe(1);
    expect(svc.count('c2')).toBe(2);
  });

  it('pushTurn() returns undefined for unknown callId', () => {
    expect(svc.pushTurn('missing', 'AI', 'x', 'en')).toBeUndefined();
  });

  it('evict() removes state and timer', () => {
    svc.init('c3', { usn: 'U', language: 'en', callType: 'ABSENT_CALL', institutionId: 'rvce' });
    expect(svc.get('c3')).toBeDefined();
    svc.evict('c3');
    expect(svc.get('c3')).toBeUndefined();
  });

  it('setKnowledgeGraph() stores graph on state', () => {
    svc.init('c4', { usn: 'U', language: 'en', callType: 'ABSENT_CALL', institutionId: 'rvce' });
    svc.setKnowledgeGraph('c4', { foo: 'bar' });
    expect(svc.get('c4')?.knowledgeGraph).toEqual({ foo: 'bar' });
  });

  it('TTL eviction fires after 5 minutes of inactivity', () => {
    jest.useFakeTimers();
    try {
      const s = new ConversationStateService();
      s.init('cTTL', { usn: 'U', language: 'en', callType: 'X', institutionId: 'i' });
      expect(s.get('cTTL')).toBeDefined();
      jest.advanceTimersByTime(5 * 60 * 1000 + 100);
      expect(s.get('cTTL')).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });
});
