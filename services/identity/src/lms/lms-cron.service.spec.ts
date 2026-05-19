/**
 * Unit tests: lms-cron.service.ts
 *
 * Tests Twilio-bound cron jobs without ever dispatching real calls:
 *  - `nightBeforeRevisionCall` — feature flag gating, idempotency, weakest-3
 *    topic selection, Twilio call dispatch with LMS_REVISION call type
 *  - `weeklyParentDigest` — feature flag, ISO-week idempotency, Gemini
 *    fallback, SMS dispatch path
 *  - `candidatesForRevisionCall` / `familiesForDigest` — production-only
 *    fan-out gated by NODE_ENV + LMS_CRON_ENABLE so dev/CI doesn't get
 *    charged for stray Twilio traffic
 *  - `isoWeek` — week-boundary determinism (Sunday/Monday cusp)
 *
 * ERP-critical: a bug in cron idempotency = duplicate Twilio call to a
 * parent on Sunday evening. Every branch here is paid for in rupees.
 */

import { LmsCronService } from './lms-cron.service';

// Module-level mocks. `getCollegeFeatures` and `geminiGenerate` are
// stubbed so each test controls flag state and LLM behaviour without
// network I/O.
const featureBag: Record<string, boolean> = {
  lms_revision_call: true,
  lms_parent_digest: true,
};
jest.mock('./tenant-context', () => ({
  getCollegeFeatures: () => featureBag,
  resolveCollegeId: () => 'col-default',
}));

const mockGemini = jest.fn();
jest.mock('../shared/gemini-ai', () => ({
  geminiGenerate: (...args: unknown[]) => mockGemini(...args),
  GEMINI_FAST: 'gemini-2.5-flash',
  GEMINI_SMART: 'gemini-2.5-pro',
}));

// Silence cron logger output during test runs.
jest.spyOn(require('@nestjs/common').Logger.prototype, 'log').mockImplementation();
jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn').mockImplementation();

function makeLmsStub(mastery: Array<{ topic: string; masteryScore: number }>) {
  return {
    getMastery: jest.fn().mockResolvedValue(mastery),
  } as any;
}

function makeCommsStub() {
  return {
    triggerCall: jest.fn().mockResolvedValue(undefined),
    sendSms: jest.fn(),
  } as any;
}

describe('LmsCronService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    featureBag.lms_revision_call = true;
    featureBag.lms_parent_digest = true;
    process.env = { ...originalEnv };
    process.env['NODE_ENV'] = 'production';
    process.env['LMS_CRON_ENABLE'] = 'true';
    delete process.env['DEFAULT_COLLEGE_ID'];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ─── nightBeforeRevisionCall ────────────────────────────────────────────

  it('nightBeforeRevisionCall: returns early when lms_revision_call flag is false', async () => {
    featureBag.lms_revision_call = false;
    const lms = makeLmsStub([]);
    const comms = makeCommsStub();
    const svc = new LmsCronService(lms, comms);
    await svc.nightBeforeRevisionCall();
    expect(lms.getMastery).not.toHaveBeenCalled();
    expect(comms.triggerCall).not.toHaveBeenCalled();
  });

  it('nightBeforeRevisionCall: returns empty candidates in non-prod without LMS_CRON_ENABLE', async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['LMS_CRON_ENABLE'] = '';
    const lms = makeLmsStub([]);
    const comms = makeCommsStub();
    const svc = new LmsCronService(lms, comms);
    await svc.nightBeforeRevisionCall();
    expect(comms.triggerCall).not.toHaveBeenCalled();
  });

  it('nightBeforeRevisionCall: dev with LMS_CRON_ENABLE=true does dispatch (override path)', async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['LMS_CRON_ENABLE'] = 'true';
    const lms = makeLmsStub([
      { topic: 'fcfs', masteryScore: 0.2 },
      { topic: 'sjf', masteryScore: 0.3 },
      { topic: 'rr', masteryScore: 0.4 },
    ]);
    const comms = makeCommsStub();
    const svc = new LmsCronService(lms, comms);
    await svc.nightBeforeRevisionCall();
    // 2 demo students × 1 call each
    expect(comms.triggerCall).toHaveBeenCalledTimes(2);
  });

  it('nightBeforeRevisionCall: picks the 3 weakest topics (mastery < 0.66) and orders ascending', async () => {
    const lms = makeLmsStub([
      { topic: 'fcfs', masteryScore: 0.9 },     // mastered — excluded
      { topic: 'sjf', masteryScore: 0.65 },     // borderline — excluded (< 0.66 strict)
      { topic: 'rr', masteryScore: 0.4 },       // included
      { topic: 'mlfq', masteryScore: 0.2 },     // included (weakest)
      { topic: 'priority', masteryScore: 0.5 }, // included
      { topic: 'deadlock', masteryScore: 0.3 }, // included BUT dropped — only 3 picked
    ]);
    const comms = makeCommsStub();
    const svc = new LmsCronService(lms, comms);
    await svc.nightBeforeRevisionCall();
    // First demo student gets called with weakest-3, ascending by mastery score
    const [, callType] = comms.triggerCall.mock.calls[0];
    expect(callType).toMatch(/^LMS_REVISION:CS501:/);
    const topics = callType.split(':').pop()!.split(',');
    expect(topics).toEqual(['mlfq', 'deadlock', 'rr']);
  });

  it('nightBeforeRevisionCall: skips call when student has 0 weak topics (all mastered)', async () => {
    const lms = makeLmsStub([
      { topic: 'fcfs', masteryScore: 0.9 },
      { topic: 'sjf', masteryScore: 0.8 },
    ]);
    const comms = makeCommsStub();
    const svc = new LmsCronService(lms, comms);
    await svc.nightBeforeRevisionCall();
    expect(comms.triggerCall).not.toHaveBeenCalled();
  });

  it('nightBeforeRevisionCall: idempotent within same UTC day — second run does NOT redispatch', async () => {
    const lms = makeLmsStub([{ topic: 'fcfs', masteryScore: 0.2 }]);
    const comms = makeCommsStub();
    const svc = new LmsCronService(lms, comms);
    await svc.nightBeforeRevisionCall();
    const firstCount = comms.triggerCall.mock.calls.length;
    await svc.nightBeforeRevisionCall();
    expect(comms.triggerCall.mock.calls.length).toBe(firstCount);
  });

  it('nightBeforeRevisionCall: swallows triggerCall errors so one bad call does not abort the batch', async () => {
    const lms = makeLmsStub([{ topic: 'fcfs', masteryScore: 0.2 }]);
    const comms = makeCommsStub();
    comms.triggerCall
      .mockRejectedValueOnce(new Error('twilio 429'))
      .mockResolvedValueOnce(undefined);
    const svc = new LmsCronService(lms, comms);
    await expect(svc.nightBeforeRevisionCall()).resolves.not.toThrow();
    expect(comms.triggerCall).toHaveBeenCalledTimes(2);
  });

  it('nightBeforeRevisionCall: passes language + collegeId + call-type prefix to comms.triggerCall', async () => {
    const lms = makeLmsStub([{ topic: 'fcfs', masteryScore: 0.2 }]);
    const comms = makeCommsStub();
    const svc = new LmsCronService(lms, comms);
    await svc.nightBeforeRevisionCall();
    const [usn, callType, collegeId, language] = comms.triggerCall.mock.calls[0];
    expect(usn).toBe('1RV21CS001');
    expect(callType).toMatch(/^LMS_REVISION:CS501:fcfs/);
    expect(collegeId).toBe('default');
    expect(language).toBe('kn');
  });

  // ─── weeklyParentDigest ─────────────────────────────────────────────────

  it('weeklyParentDigest: returns early when lms_parent_digest flag is false', async () => {
    featureBag.lms_parent_digest = false;
    const lms = makeLmsStub([{ topic: 'fcfs', masteryScore: 0.9 }]);
    const comms = makeCommsStub();
    const svc = new LmsCronService(lms, comms);
    await svc.weeklyParentDigest();
    expect(comms.sendSms).not.toHaveBeenCalled();
  });

  it('weeklyParentDigest: dispatches SMS with Gemini-built summary', async () => {
    const lms = makeLmsStub([
      { topic: 'fcfs', masteryScore: 0.9 },
      { topic: 'sjf', masteryScore: 0.8 },
    ]);
    const comms = makeCommsStub();
    mockGemini.mockResolvedValueOnce('   ನಿಮ್ಮ ಮಗ ಈ ವಾರ ಎರಡು ವಿಷಯ ಕಲಿತಿದ್ದಾನೆ. ');
    const svc = new LmsCronService(lms, comms);
    await svc.weeklyParentDigest();
    expect(comms.sendSms).toHaveBeenCalled();
    const [phone, body] = comms.sendSms.mock.calls[0];
    expect(phone).toMatch(/^\+91/);
    expect(body).not.toMatch(/^\s/); // trim() worked
  });

  it('weeklyParentDigest: falls back to static summary when Gemini throws', async () => {
    const lms = makeLmsStub([{ topic: 'fcfs', masteryScore: 0.9 }]);
    const comms = makeCommsStub();
    mockGemini.mockRejectedValueOnce(new Error('gemini quota'));
    const svc = new LmsCronService(lms, comms);
    await svc.weeklyParentDigest();
    const [, body] = comms.sendSms.mock.calls[0];
    expect(body).toMatch(/mastered 1 topic this week/i);
    expect(body).toMatch(/fcfs/);
  });

  it('weeklyParentDigest: pluralises "topics" correctly for 2+ topics in fallback', async () => {
    const lms = makeLmsStub([
      { topic: 'fcfs', masteryScore: 0.9 },
      { topic: 'sjf', masteryScore: 0.8 },
    ]);
    const comms = makeCommsStub();
    mockGemini.mockRejectedValueOnce(new Error('gemini quota'));
    const svc = new LmsCronService(lms, comms);
    await svc.weeklyParentDigest();
    const [, body] = comms.sendSms.mock.calls[0];
    expect(body).toMatch(/mastered 2 topics this week/i);
  });

  it('weeklyParentDigest: no SMS sent when student has zero mastered topics (empty summary)', async () => {
    const lms = makeLmsStub([{ topic: 'fcfs', masteryScore: 0.3 }]); // not mastered
    const comms = makeCommsStub();
    const svc = new LmsCronService(lms, comms);
    await svc.weeklyParentDigest();
    expect(comms.sendSms).not.toHaveBeenCalled();
    expect(mockGemini).not.toHaveBeenCalled();
  });

  it('weeklyParentDigest: idempotent across the same ISO week — second run does NOT re-send', async () => {
    const lms = makeLmsStub([{ topic: 'fcfs', masteryScore: 0.9 }]);
    const comms = makeCommsStub();
    mockGemini.mockResolvedValue('summary');
    const svc = new LmsCronService(lms, comms);
    await svc.weeklyParentDigest();
    const firstCount = comms.sendSms.mock.calls.length;
    await svc.weeklyParentDigest();
    expect(comms.sendSms.mock.calls.length).toBe(firstCount);
  });

  it('weeklyParentDigest: swallows per-family failures so one bad SMS does not abort the batch', async () => {
    const lms = makeLmsStub([{ topic: 'fcfs', masteryScore: 0.9 }]);
    const comms = makeCommsStub();
    mockGemini.mockResolvedValue('summary');
    comms.sendSms
      .mockImplementationOnce(() => {
        throw new Error('twilio down');
      })
      .mockImplementationOnce(() => undefined);
    const svc = new LmsCronService(lms, comms);
    await expect(svc.weeklyParentDigest()).resolves.not.toThrow();
    expect(comms.sendSms).toHaveBeenCalledTimes(2);
  });

  it('weeklyParentDigest: returns empty families in non-prod without LMS_CRON_ENABLE', async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['LMS_CRON_ENABLE'] = '';
    const lms = makeLmsStub([{ topic: 'fcfs', masteryScore: 0.9 }]);
    const comms = makeCommsStub();
    const svc = new LmsCronService(lms, comms);
    await svc.weeklyParentDigest();
    expect(comms.sendSms).not.toHaveBeenCalled();
  });

  // ─── Manual triggers (exposed for QA / Jira demos) ──────────────────────

  it('runRevisionNow + runDigestNow proxy to the cron methods', async () => {
    const lms = makeLmsStub([{ topic: 'fcfs', masteryScore: 0.2 }]);
    const comms = makeCommsStub();
    mockGemini.mockResolvedValue('summary');
    const svc = new LmsCronService(lms, comms);
    await svc.runRevisionNow();
    expect(comms.triggerCall).toHaveBeenCalled();
    await svc.runDigestNow();
    expect(comms.sendSms).not.toHaveBeenCalled(); // no mastered topics in this fixture
  });

  // ─── isoWeek helper ─────────────────────────────────────────────────────

  it('isoWeek: returns deterministic year-week string for a known date', () => {
    const svc = new LmsCronService({} as any, {} as any);
    // Access private method via cast — this is a unit-test exception.
    const w = (svc as any).isoWeek(new Date('2026-01-05T10:00:00Z')); // Mon week 2
    expect(w).toMatch(/^\d{4}-W\d{2}$/);
    expect(w).toBe('2026-W02');
  });

  it('isoWeek: ISO week boundary — Sunday returns prior week, following Monday returns next week', () => {
    const svc = new LmsCronService({} as any, {} as any);
    // 2026-01-04 is a Sunday — ISO week assigns it to W01 (Mon-Sun of W01).
    // 2026-01-05 is a Monday — start of W02.
    const sun = (svc as any).isoWeek(new Date('2026-01-04T12:00:00Z'));
    const mon = (svc as any).isoWeek(new Date('2026-01-05T12:00:00Z'));
    expect(sun).toBe('2026-W01');
    expect(mon).toBe('2026-W02');
  });

  it('isoWeek: end-of-year edge (Dec 31 may belong to W01 of next year by ISO rule)', () => {
    const svc = new LmsCronService({} as any, {} as any);
    const w = (svc as any).isoWeek(new Date('2025-12-31T00:00:00Z'));
    // 2025-12-31 is a Wednesday → ISO week 2026-W01.
    expect(w).toBe('2026-W01');
  });
});
