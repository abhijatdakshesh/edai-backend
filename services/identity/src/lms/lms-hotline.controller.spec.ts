/**
 * Unit tests: lms-hotline.controller.ts
 *
 * The hotline serves TwiML XML to Twilio inbound calls. A malformed XML
 * response = the call drops mid-sentence on a parent calling about their
 * child's grades. Every branch here needs explicit coverage:
 *
 *   - IVR initial XML (includes all 5 menu options + collegeId encoding)
 *   - menu() — DTMF digit routes (1-4, 0), unknown digit fallback
 *   - menu() — direct speech path vs digit path
 *   - turn() — session-expired hang-up
 *   - turn() — courseId extraction from state.callType ("HOTLINE:CS502")
 *   - turn() — default CS501 when callType lacks HOTLINE: prefix
 *   - statusCallback — evicts state for completed/failed/no-answer/busy only
 *   - buildTurnXml — Gemini failure fallback (Kannada vs English)
 *   - buildTurnXml — Sarvam audio null → <Say> fallback
 *   - buildTurnXml — empty userSpeech greetings per language
 *   - escXml — every character it must escape (via Gemini reply containing them)
 */

import { LmsHotlineController } from './lms-hotline.controller';

jest.mock('./tenant-context', () => ({
  resolveCollegeId: (req: any) => req?.collegeIdOverride ?? 'col-rvce',
}));

const mockGemini = jest.fn();
jest.mock('../shared/gemini-ai', () => ({
  geminiGenerate: (...args: unknown[]) => mockGemini(...args),
  GEMINI_FAST: 'gemini-2.5-flash',
}));

// Silence logger.
jest.spyOn(require('@nestjs/common').Logger.prototype, 'log').mockImplementation();
jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn').mockImplementation();

function makeRes(): any {
  const res: any = {};
  res.body = {};
  res.type = jest.fn((ct: string) => {
    res.body.contentType = ct;
    return res;
  });
  res.send = jest.fn((xml: string) => {
    res.body.xml = xml;
    return res;
  });
  return res;
}

function makeReq(opts: { url?: string; collegeIdOverride?: string } = {}): any {
  return {
    url: opts.url ?? '/api/lms/hotline/twiml',
    collegeIdOverride: opts.collegeIdOverride,
  };
}

function makeLmsStub(): any {
  return {
    listModules: jest.fn().mockResolvedValue([{ id: 'm1' }]),
    listLessons: jest.fn().mockResolvedValue([
      { title: 'Process Scheduling' },
      { title: 'Deadlocks' },
    ]),
  };
}

function makeCommsStub(opts: { audio?: Buffer | null; signed?: string } = {}): any {
  return {
    generateSarvamAudioPublic: jest.fn().mockResolvedValue(opts.audio ?? null),
    setAudioPublic: jest.fn(),
    signAudioUrl: jest.fn().mockReturnValue(opts.signed ?? 'https://example.test/audio/x'),
  };
}

function makeConvStub(state: any = { language: 'kn', callType: 'HOTLINE:CS501' }): any {
  return {
    init: jest.fn(),
    get: jest.fn().mockReturnValue(state),
    evict: jest.fn(),
    pushTurn: jest.fn(),
  };
}

describe('LmsHotlineController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['TWILIO_WEBHOOK_BASE_URL'];
    delete process.env['APP_URL'];
  });

  // ─── escXml (via Gemini reply containing offenders) ─────────────────────

  it('Gemini reply containing offenders is XML-escaped in the <Say> body', async () => {
    mockGemini.mockResolvedValueOnce(`Reply with & < > " ' chars`);
    const lms = makeLmsStub();
    const comms = makeCommsStub({ audio: null });
    const conv = makeConvStub({ language: 'en', callType: 'HOTLINE:CS501' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    const res = makeRes();
    await ctrl.turn('call-1', { SpeechResult: 'What is FCFS?' }, makeReq(), res);
    const xml = res.body.xml as string;
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
    expect(xml).toContain('&apos;');
    const sayMatch = xml.match(/<Say[^>]*>([^<]*)<\/Say>/);
    expect(sayMatch).toBeTruthy();
    expect(sayMatch![1]).not.toMatch(/[<>]/);
  });

  // ─── ivr ────────────────────────────────────────────────────────────────

  it('ivr: returns TwiML with all 5 menu entries and a Hangup fallback', () => {
    const ctrl = new LmsHotlineController(makeLmsStub(), makeCommsStub(), makeConvStub());
    const res = makeRes();
    ctrl.ivr(makeReq(), res);
    expect(res.body.contentType).toBe('text/xml');
    const xml = res.body.xml as string;
    expect(xml).toMatch(/Press 1 for Operating Systems/);
    expect(xml).toMatch(/Press 2 for Database Management Systems/);
    expect(xml).toMatch(/Press 3 for Data Structures/);
    expect(xml).toMatch(/Press 4 for Computer Networks/);
    expect(xml).toMatch(/Press 0 for Operating Systems \(English\)/);
    expect(xml).toContain('<Hangup/>');
  });

  it('ivr: appends ?collegeId= when req.url has no existing query string', () => {
    const ctrl = new LmsHotlineController(makeLmsStub(), makeCommsStub(), makeConvStub());
    const res = makeRes();
    ctrl.ivr(makeReq({ url: '/api/lms/hotline/twiml' }), res);
    expect(res.body.xml).toMatch(/menu\?collegeId=col-rvce/);
  });

  it('ivr: appends &collegeId= when req.url already has a query string', () => {
    const ctrl = new LmsHotlineController(makeLmsStub(), makeCommsStub(), makeConvStub());
    const res = makeRes();
    ctrl.ivr(makeReq({ url: '/api/lms/hotline/twiml?from=+91123' }), res);
    expect(res.body.xml).toMatch(/menu&collegeId=col-rvce/);
  });

  // ─── menu ───────────────────────────────────────────────────────────────

  it('menu: digit "1" routes to CS501 with kn language', async () => {
    const lms = makeLmsStub();
    const comms = makeCommsStub();
    const conv = makeConvStub();
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.menu(makeReq(), { Digits: '1' }, makeRes());
    expect(conv.init).toHaveBeenCalledWith(
      expect.stringMatching(/^hot-/),
      expect.objectContaining({
        callType: 'HOTLINE:CS501',
        language: 'kn',
        usn: 'HOTLINE',
      }),
    );
  });

  it('menu: digit "0" routes to English course', async () => {
    const lms = makeLmsStub();
    const comms = makeCommsStub();
    const conv = makeConvStub();
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.menu(makeReq(), { Digits: '0' }, makeRes());
    expect(conv.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ language: 'en', callType: 'HOTLINE:CS501' }),
    );
  });

  it('menu: unknown digit defaults to first menu entry (CS501)', async () => {
    const lms = makeLmsStub();
    const comms = makeCommsStub();
    const conv = makeConvStub();
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.menu(makeReq(), { Digits: '9' }, makeRes());
    expect(conv.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ callType: 'HOTLINE:CS501' }),
    );
  });

  it('menu: direct speech (no digit) routes to default course AND seeds the turn with the question', async () => {
    mockGemini.mockResolvedValueOnce('Kannada explanation');
    const lms = makeLmsStub();
    const comms = makeCommsStub({ audio: Buffer.from('audio-bytes') });
    const conv = makeConvStub();
    const ctrl = new LmsHotlineController(lms, comms, conv);
    const res = makeRes();
    await ctrl.menu(makeReq(), { SpeechResult: 'What is FCFS?' }, res);
    expect(mockGemini).toHaveBeenCalled();
    const prompt = mockGemini.mock.calls[0][0] as string;
    expect(prompt).toMatch(/Caller said: "What is FCFS\?"/);
    expect(res.body.xml).toContain('<Play>');
  });

  // ─── turn ───────────────────────────────────────────────────────────────

  it('turn: session expired (no state) returns hang-up TwiML', async () => {
    const conv = makeConvStub();
    conv.get.mockReturnValueOnce(undefined);
    const ctrl = new LmsHotlineController(makeLmsStub(), makeCommsStub(), conv);
    const res = makeRes();
    await ctrl.turn('expired-call', {}, makeReq(), res);
    expect(res.body.xml).toContain('Session timed out');
    expect(res.body.xml).toContain('<Hangup/>');
    expect(mockGemini).not.toHaveBeenCalled();
  });

  it('turn: extracts courseId from state.callType "HOTLINE:CS502"', async () => {
    mockGemini.mockResolvedValueOnce('reply');
    const lms = makeLmsStub();
    const comms = makeCommsStub({ audio: Buffer.from('a') });
    const conv = makeConvStub({ language: 'kn', callType: 'HOTLINE:CS502' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.turn('call-1', { SpeechResult: 'Q' }, makeReq(), makeRes());
    expect(lms.listModules).toHaveBeenCalledWith('col-rvce', 'CS502');
  });

  it('turn: defaults to CS501 when callType lacks HOTLINE: prefix', async () => {
    mockGemini.mockResolvedValueOnce('reply');
    const lms = makeLmsStub();
    const comms = makeCommsStub({ audio: Buffer.from('a') });
    const conv = makeConvStub({ language: 'kn', callType: 'INBOUND_VOICE' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.turn('call-1', { SpeechResult: 'Q' }, makeReq(), makeRes());
    expect(lms.listModules).toHaveBeenCalledWith('col-rvce', 'CS501');
  });

  it('turn: combines SpeechResult + Digits when both provided', async () => {
    mockGemini.mockResolvedValueOnce('reply');
    const lms = makeLmsStub();
    const comms = makeCommsStub({ audio: Buffer.from('a') });
    const conv = makeConvStub();
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.turn(
      'call-1',
      { SpeechResult: 'Hello', Digits: '7' },
      makeReq(),
      makeRes(),
    );
    const prompt = mockGemini.mock.calls[0][0] as string;
    expect(prompt).toMatch(/Caller said: "Hello 7"/);
  });

  // ─── statusCallback ─────────────────────────────────────────────────────

  it.each(['completed', 'failed', 'no-answer', 'busy'])(
    'statusCallback: evicts state when CallStatus="%s"',
    async (status) => {
      const conv = makeConvStub();
      const ctrl = new LmsHotlineController(makeLmsStub(), makeCommsStub(), conv);
      await ctrl.statusCallback('call-x', { CallStatus: status });
      expect(conv.evict).toHaveBeenCalledWith('call-x');
    },
  );

  it.each(['ringing', 'in-progress', 'queued'])(
    'statusCallback: does NOT evict for non-terminal status "%s"',
    async (status) => {
      const conv = makeConvStub();
      const ctrl = new LmsHotlineController(makeLmsStub(), makeCommsStub(), conv);
      await ctrl.statusCallback('call-x', { CallStatus: status });
      expect(conv.evict).not.toHaveBeenCalled();
    },
  );

  it('statusCallback: undefined CallStatus does not evict', async () => {
    const conv = makeConvStub();
    const ctrl = new LmsHotlineController(makeLmsStub(), makeCommsStub(), conv);
    await ctrl.statusCallback('call-x', {});
    expect(conv.evict).not.toHaveBeenCalled();
  });

  // ─── buildTurnXml: empty userSpeech greetings ───────────────────────────

  it('buildTurnXml (kn): empty userSpeech → Kannada greeting', async () => {
    const lms = makeLmsStub();
    const comms = makeCommsStub({ audio: Buffer.from('a') });
    const conv = makeConvStub({ language: 'kn', callType: 'HOTLINE:CS501' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.menu(makeReq(), {}, makeRes());
    expect(conv.pushTurn).toHaveBeenCalledWith(
      expect.any(String),
      'AI',
      expect.stringMatching(/ನಮಸ್ಕಾರ|ಸ್ವಾಗತ/),
      'kn',
    );
    expect(mockGemini).not.toHaveBeenCalled();
  });

  it('buildTurnXml (hi): empty userSpeech → Hindi greeting', async () => {
    const lms = makeLmsStub();
    const comms = makeCommsStub({ audio: Buffer.from('a') });
    const conv = makeConvStub({ language: 'hi', callType: 'HOTLINE:CS501' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.turn('call-1', {}, makeReq(), makeRes());
    expect(conv.pushTurn).toHaveBeenCalledWith(
      expect.any(String),
      'AI',
      expect.stringMatching(/नमस्ते|स्वागत/),
      'hi',
    );
  });

  it('buildTurnXml (en): empty userSpeech → English greeting', async () => {
    const lms = makeLmsStub();
    const comms = makeCommsStub();
    const conv = makeConvStub({ language: 'en', callType: 'HOTLINE:CS501' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.turn('call-1', {}, makeReq(), makeRes());
    expect(conv.pushTurn).toHaveBeenCalledWith(
      expect.any(String),
      'AI',
      expect.stringMatching(/Hello, welcome to/),
      'en',
    );
  });

  // ─── buildTurnXml: Gemini failure fallbacks ─────────────────────────────

  it('buildTurnXml: Gemini throw → Kannada fallback message for kn language', async () => {
    mockGemini.mockRejectedValueOnce(new Error('quota'));
    const lms = makeLmsStub();
    const comms = makeCommsStub({ audio: Buffer.from('a') });
    const conv = makeConvStub({ language: 'kn', callType: 'HOTLINE:CS501' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.turn(
      'call-1',
      { SpeechResult: 'What is paging?' },
      makeReq(),
      makeRes(),
    );
    expect(conv.pushTurn).toHaveBeenCalledWith(
      expect.any(String),
      'AI',
      expect.stringMatching(/ಕ್ಷಮಿಸಿ/),
      'kn',
    );
  });

  it('buildTurnXml: Gemini throw → English fallback for en language', async () => {
    mockGemini.mockRejectedValueOnce(new Error('quota'));
    const lms = makeLmsStub();
    const comms = makeCommsStub();
    const conv = makeConvStub({ language: 'en', callType: 'HOTLINE:CS501' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    await ctrl.turn(
      'call-1',
      { SpeechResult: 'What is paging?' },
      makeReq(),
      makeRes(),
    );
    expect(conv.pushTurn).toHaveBeenCalledWith(
      expect.any(String),
      'AI',
      expect.stringMatching(/Sorry, I had trouble/),
      'en',
    );
  });

  // ─── buildTurnXml: Sarvam audio fallback ────────────────────────────────

  it('buildTurnXml: Sarvam returns null → <Say> with langTag instead of <Play>', async () => {
    mockGemini.mockResolvedValueOnce('Kannada reply');
    const lms = makeLmsStub();
    const comms = makeCommsStub({ audio: null });
    const conv = makeConvStub({ language: 'kn', callType: 'HOTLINE:CS501' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    const res = makeRes();
    await ctrl.turn('call-1', { SpeechResult: 'Q' }, makeReq(), res);
    expect(res.body.xml).not.toContain('<Play>');
    expect(res.body.xml).toContain('<Say');
    expect(res.body.xml).toMatch(/language="kn-IN"/);
  });

  it('buildTurnXml: Sarvam audio returned → <Play> signed URL', async () => {
    mockGemini.mockResolvedValueOnce('reply');
    const lms = makeLmsStub();
    const comms = makeCommsStub({
      audio: Buffer.from('audio'),
      signed: 'https://cdn.test/abc',
    });
    const conv = makeConvStub({ language: 'kn', callType: 'HOTLINE:CS501' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    const res = makeRes();
    await ctrl.turn('call-1', { SpeechResult: 'Q' }, makeReq(), res);
    expect(comms.setAudioPublic).toHaveBeenCalled();
    expect(comms.signAudioUrl).toHaveBeenCalled();
    expect(res.body.xml).toContain('<Play>https://cdn.test/abc</Play>');
  });

  it('buildTurnXml: unknown BCP-47 language falls back to en-IN', async () => {
    mockGemini.mockResolvedValueOnce('reply');
    const lms = makeLmsStub();
    const comms = makeCommsStub({ audio: null });
    const conv = makeConvStub({ language: 'xx' as any, callType: 'HOTLINE:CS501' });
    const ctrl = new LmsHotlineController(lms, comms, conv);
    const res = makeRes();
    await ctrl.turn('call-1', { SpeechResult: 'Q' }, makeReq(), res);
    expect(res.body.xml).toMatch(/language="en-IN"/);
  });
});
