import { Test, TestingModule } from '@nestjs/testing';
import { FeeMessagingService } from './fee-messaging.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFetchOk(body: Record<string, unknown>) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function makeFetchFail(status: number) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FeeMessagingService', () => {
  let service: FeeMessagingService;
  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset env to a clean slate before each test
    process.env = { ...originalEnv };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FeeMessagingService],
    }).compile();

    service = module.get<FeeMessagingService>(FeeMessagingService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ─── sendWhatsApp ─────────────────────────────────────────────────────────

  describe('sendWhatsApp()', () => {
    it('returns "mock-sid" and warns when TWILIO_ACCOUNT_SID is not set', async () => {
      delete process.env['TWILIO_ACCOUNT_SID'];
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      const result = await service.sendWhatsApp('+919876543210', 'Test message');

      expect(result).toBe('mock-sid');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Twilio not configured'),
      );
    });

    it('calls Twilio Messages API with correct params when SID is configured', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACtest123';
      process.env['TWILIO_AUTH_TOKEN'] = 'auth-token-abc';
      process.env['TWILIO_WHATSAPP_NUMBER'] = '+14155238886';
      global.fetch = makeFetchOk({ sid: 'SM_whatsapp_123' });

      const result = await service.sendWhatsApp('+919876543210', 'Fee reminder message');

      expect(result).toBe('SM_whatsapp_123');
      const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('ACtest123/Messages.json');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Authorization']).toMatch(/^Basic /);
      expect(opts.body).toContain('whatsapp%3A%2B919876543210');
    });

    it('falls back to TWILIO_FROM_NUMBER when TWILIO_WHATSAPP_NUMBER is absent', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACtest123';
      process.env['TWILIO_AUTH_TOKEN'] = 'auth-token-abc';
      delete process.env['TWILIO_WHATSAPP_NUMBER'];
      process.env['TWILIO_FROM_NUMBER'] = '+14155550000';
      global.fetch = makeFetchOk({ sid: 'SM_fallback_456' });

      const result = await service.sendWhatsApp('+919876543210', 'Message');

      expect(result).toBe('SM_fallback_456');
      const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
      expect(opts.body).toContain('whatsapp%3A%2B14155550000');
    });

    it('throws when Twilio returns a non-ok response', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACtest123';
      process.env['TWILIO_AUTH_TOKEN'] = 'auth-token-abc';
      global.fetch = makeFetchFail(429);

      await expect(
        service.sendWhatsApp('+919876543210', 'Test'),
      ).rejects.toThrow('Twilio WhatsApp error 429');
    });

    it('logs success after sending WhatsApp', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACtest123';
      process.env['TWILIO_AUTH_TOKEN'] = 'token';
      global.fetch = makeFetchOk({ sid: 'SM_log_test' });
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.sendWhatsApp('+919876543210', 'msg');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('SM_log_test'),
      );
    });

    // ERP edge: both WHATSAPP_NUMBER and FROM_NUMBER absent — empty from field
    it('uses empty string for from-number when neither env var is set', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACtest123';
      process.env['TWILIO_AUTH_TOKEN'] = 'token';
      delete process.env['TWILIO_WHATSAPP_NUMBER'];
      delete process.env['TWILIO_FROM_NUMBER'];
      global.fetch = makeFetchOk({ sid: 'SM_empty' });

      const result = await service.sendWhatsApp('+919876543210', 'msg');
      expect(result).toBe('SM_empty');
    });
  });

  // ─── sendSms ─────────────────────────────────────────────────────────────

  describe('sendSms()', () => {
    it('returns "mock-sid" and warns when TWILIO_ACCOUNT_SID is not set', async () => {
      delete process.env['TWILIO_ACCOUNT_SID'];
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      const result = await service.sendSms('+919876543210', 'SMS test');

      expect(result).toBe('mock-sid');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Twilio not configured'),
      );
    });

    it('calls Twilio Messages API with SMS params when SID is configured', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACtest123';
      process.env['TWILIO_AUTH_TOKEN'] = 'auth-token-abc';
      process.env['TWILIO_FROM_NUMBER'] = '+14155550000';
      global.fetch = makeFetchOk({ sid: 'SM_sms_789' });

      const result = await service.sendSms('+919876543210', 'Fee reminder SMS');

      expect(result).toBe('SM_sms_789');
      const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('ACtest123/Messages.json');
      expect(opts.method).toBe('POST');
      // SMS body must NOT include whatsapp: prefix
      expect(opts.body).not.toContain('whatsapp');
      expect(opts.body).toContain('%2B919876543210');
    });

    it('throws when Twilio returns a non-ok response', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACtest123';
      process.env['TWILIO_AUTH_TOKEN'] = 'auth-token-abc';
      global.fetch = makeFetchFail(500);

      await expect(
        service.sendSms('+919876543210', 'msg'),
      ).rejects.toThrow('Twilio SMS error 500');
    });

    it('logs success after sending SMS', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACtest123';
      process.env['TWILIO_AUTH_TOKEN'] = 'token';
      process.env['TWILIO_FROM_NUMBER'] = '+14155550000';
      global.fetch = makeFetchOk({ sid: 'SM_sms_log' });
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.sendSms('+919876543210', 'msg');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('SM_sms_log'),
      );
    });

    // ERP edge: absent FROM_NUMBER results in empty From param — still sends
    it('uses empty from-number when TWILIO_FROM_NUMBER is absent', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACtest123';
      process.env['TWILIO_AUTH_TOKEN'] = 'token';
      delete process.env['TWILIO_FROM_NUMBER'];
      global.fetch = makeFetchOk({ sid: 'SM_nofrom' });

      const result = await service.sendSms('+919876543210', 'msg');
      expect(result).toBe('SM_nofrom');
    });
  });

  // ─── triggerFeeCall ──────────────────────────────────────────────────────

  describe('triggerFeeCall()', () => {
    const feeDetails = { feeType: 'TUITION', balance: 45000, dueDate: '30 Jun 2025' };

    it('calls voice service and returns callId on success', async () => {
      process.env['VOICE_SERVICE_URL'] = 'http://voice:8080';
      global.fetch = makeFetchOk({ callId: 'call-uuid-abc' });

      const result = await service.triggerFeeCall(
        '1RV21CS001', '+919876543210', 'kn', feeDetails,
      );

      expect(result).toBe('call-uuid-abc');
      const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('http://voice:8080/voice/calls/trigger');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.studentId).toBe('1RV21CS001');
      expect(body.callType).toBe('FEE_REMINDER');
      expect(body.language).toBe('kn');
      expect(body.studentContext.parentPhone).toBe('+919876543210');
      expect(body.studentContext.balance).toBe(45000);
    });

    it('throws when voice service returns non-ok response', async () => {
      process.env['VOICE_SERVICE_URL'] = 'http://voice:8080';
      global.fetch = makeFetchFail(503);

      await expect(
        service.triggerFeeCall('1RV21CS001', '+919876543210', 'en', feeDetails),
      ).rejects.toThrow('Voice service responded 503');
    });

    it('falls back to http://localhost:8080 when VOICE_SERVICE_URL is absent', async () => {
      delete process.env['VOICE_SERVICE_URL'];
      global.fetch = makeFetchOk({ callId: 'call-local' });

      const result = await service.triggerFeeCall(
        '1RV21CS001', '+919876543210', 'en', feeDetails,
      );

      expect(result).toBe('call-local');
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('localhost:8080');
    });

    it('logs success with studentId and callId', async () => {
      process.env['VOICE_SERVICE_URL'] = 'http://voice:8080';
      global.fetch = makeFetchOk({ callId: 'call-log-check' });
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.triggerFeeCall('1RV21CS001', '+919876543210', 'hi', feeDetails);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('call-log-check'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('1RV21CS001'),
      );
    });

    it('sends correct feeType and dueDate in request body', async () => {
      process.env['VOICE_SERVICE_URL'] = 'http://voice:8080';
      global.fetch = makeFetchOk({ callId: 'call-check' });

      await service.triggerFeeCall('1RV21CS001', '+91999', 'ta', {
        feeType: 'HOSTEL', balance: 12000, dueDate: '15 Jul 2025',
      });

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body.studentContext.feeType).toBe('HOSTEL');
      expect(body.studentContext.dueDate).toBe('15 Jul 2025');
    });
  });

  // ─── twilioAuth (private — tested indirectly) ────────────────────────────

  describe('twilioAuth() — Authorization header encoding', () => {
    it('encodes SID:TOKEN in Base64 and prefixes with Basic', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACabc';
      process.env['TWILIO_AUTH_TOKEN'] = 'secret';
      global.fetch = makeFetchOk({ sid: 'SM_auth_test' });

      await service.sendWhatsApp('+91999', 'msg');

      const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
      const expected = 'Basic ' + Buffer.from('ACabc:secret').toString('base64');
      expect(opts.headers['Authorization']).toBe(expected);
    });

    it('encodes SID: (empty token) when TWILIO_AUTH_TOKEN is absent', async () => {
      process.env['TWILIO_ACCOUNT_SID'] = 'ACabc';
      delete process.env['TWILIO_AUTH_TOKEN'];
      global.fetch = makeFetchOk({ sid: 'SM_no_token' });

      await service.sendWhatsApp('+91999', 'msg');

      const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
      const expected = 'Basic ' + Buffer.from('ACabc:').toString('base64');
      expect(opts.headers['Authorization']).toBe(expected);
    });

    it('encodes ":" when both TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are absent', () => {
      delete process.env['TWILIO_ACCOUNT_SID'];
      delete process.env['TWILIO_AUTH_TOKEN'];

      const auth = (service as any).twilioAuth() as string;

      const expected = 'Basic ' + Buffer.from(':').toString('base64');
      expect(auth).toBe(expected);
    });
  });
});
