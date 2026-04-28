import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { FeeRemindersService, FeeRiskRow, validateVoiceServiceUrl } from './fee-reminders.service';
import { FeeMessagingService } from './fee-messaging.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFeeRow(overrides: Partial<FeeRiskRow> = {}): FeeRiskRow {
  return {
    fee_payment_id: 'fee-uuid-001',
    student_usn: '1RV21CS001',
    student_name: 'Ravi Kumar',
    parent_phone: '+919876543210',
    language: 'kn',
    fee_type: 'TUITION',
    balance: 45000,
    due_date: new Date('2025-06-30'),
    days_to_due: 10,
    risk_score: 85,
    risk_level: 'HIGH',
    fee_status: 'PENDING',
    department: 'CSE',
    attendance_pct: 72,
    ...overrides,
  };
}

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockDataSource = { query: mockQuery };

const mockMessaging = {
  sendWhatsApp: jest.fn(),
  sendSms: jest.fn(),
  triggerFeeCall: jest.fn(),
};

async function buildService(withDb = true): Promise<FeeRemindersService> {
  const providers: unknown[] = [
    FeeRemindersService,
    { provide: FeeMessagingService, useValue: mockMessaging },
  ];
  if (withDb) {
    providers.push({ provide: getDataSourceToken(), useValue: mockDataSource });
  }
  const module: TestingModule = await Test.createTestingModule({
    providers: providers as Parameters<typeof Test.createTestingModule>[0]['providers'],
  }).compile();
  return module.get<FeeRemindersService>(FeeRemindersService);
}

// ─── processReminder mock-query helpers ──────────────────────────────────────
//
// processReminder flow (per fee in nightly chain):
//   call N+0: main SELECT (done once by runNightlyReminderChain before loop)
//   call N+1: INSERT ON CONFLICT RETURNING id (atomic dedup)
//             → if returns [{id}]: continue to send
//             → if returns []:     dedup hit — skip
//
// On send failure:
//   call N+2: UPDATE SET status='FAILED'

function setupNightlyWithFee(
  fee: FeeRiskRow,
  insertReturns: { id: string }[],
  sendFails = false,
) {
  mockQuery
    .mockResolvedValueOnce([fee])       // main SELECT
    .mockResolvedValueOnce(insertReturns); // INSERT ON CONFLICT RETURNING

  if (insertReturns.length > 0 && sendFails) {
    mockQuery.mockResolvedValueOnce([]); // UPDATE status=FAILED
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FeeRemindersService', () => {
  let service: FeeRemindersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await buildService(true);
  });

  // ─── getDashboardSummary ─────────────────────────────────────────────────

  describe('getDashboardSummary()', () => {
    it('returns summary row from DB', async () => {
      const summaryRow = {
        total_outstanding_count: '12',
        total_outstanding_amount: '540000',
        high_risk_count: '4',
      };
      mockQuery.mockResolvedValueOnce([summaryRow]);

      const result = await service.getDashboardSummary();
      expect(result).toBe(summaryRow);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('returns {} when DB is null (no-DB fallback)', async () => {
      const noDbService = await buildService(false);
      const result = await noDbService.getDashboardSummary();
      expect(result).toEqual({});
    });
  });

  // ─── getOutstandingFees ──────────────────────────────────────────────────

  describe('getOutstandingFees()', () => {
    it('returns [] when DB is null (no-DB fallback)', async () => {
      const noDbService = await buildService(false);
      const result = await noDbService.getOutstandingFees({});
      expect(result).toEqual([]);
    });

    it('queries without optional filters when none supplied', async () => {
      mockQuery.mockResolvedValueOnce([makeFeeRow()]);
      const result = await service.getOutstandingFees({});

      expect(result).toHaveLength(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE 1=1');
      expect(sql).not.toContain('risk_level');
      expect(sql).not.toContain('department');
      expect(sql).not.toContain('days_to_due < 0');
      expect(params).toContain(100); // default limit
    });

    it('appends overdueOnly clause when overdueOnly=true', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getOutstandingFees({ overdueOnly: true });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('days_to_due < 0');
    });

    it('does NOT append overdueOnly clause when overdueOnly=false', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getOutstandingFees({ overdueOnly: false });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('days_to_due < 0');
    });

    it('appends riskLevel filter and calls toUpperCase internally', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getOutstandingFees({ riskLevel: 'HIGH' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('risk_level =');
      expect(params).toContain('HIGH');
    });

    it('appends department filter when provided', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getOutstandingFees({ department: 'ECE' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('department =');
      expect(params).toContain('ECE');
    });

    it('applies all filters simultaneously with custom limit', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getOutstandingFees({
        riskLevel: 'MEDIUM',
        department: 'MECH',
        overdueOnly: true,
        limit: 25,
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('days_to_due < 0');
      expect(sql).toContain('risk_level =');
      expect(sql).toContain('department =');
      expect(params).toContain('MEDIUM');
      expect(params).toContain('MECH');
      expect(params).toContain(25);
    });

    it('uses limit=100 as default when limit is not supplied', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getOutstandingFees({ riskLevel: 'LOW' });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[params.length - 1]).toBe(100);
    });

    // ERP edge: attendance exactly 75% — eligible but in fee-default risk list
    it('ERP: returns fee rows for students at exactly 75% attendance boundary', async () => {
      const feeRow = makeFeeRow({ attendance_pct: 75, risk_level: 'MEDIUM' });
      mockQuery.mockResolvedValueOnce([feeRow]);

      const result = await service.getOutstandingFees({ riskLevel: 'MEDIUM' });
      expect(result[0].attendance_pct).toBe(75);
    });
  });

  // ─── getReminderHistory ──────────────────────────────────────────────────

  describe('getReminderHistory()', () => {
    it('returns [] when DB is null (no-DB fallback)', async () => {
      const noDbService = await buildService(false);
      const result = await noDbService.getReminderHistory('fee-uuid-001');
      expect(result).toEqual([]);
    });

    it('queries history for the given feePaymentId and returns results', async () => {
      const historyRow = {
        id: 'rem-uuid-1',
        fee_payment_id: 'fee-uuid-001',
        reminder_type: 'WHATSAPP_10D',
        status: 'SENT',
      };
      mockQuery.mockResolvedValueOnce([historyRow]);

      const result = await service.getReminderHistory('fee-uuid-001');

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('fee_payment_id = $1'),
        ['fee-uuid-001'],
      );
    });

    it('returns empty array when no history rows found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getReminderHistory('fee-uuid-999');
      expect(result).toEqual([]);
    });

    it('orders history by sent_at DESC', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getReminderHistory('fee-uuid-001');

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ORDER BY sent_at DESC');
    });
  });

  // ─── triggerManualCall ───────────────────────────────────────────────────

  describe('triggerManualCall()', () => {
    it('throws when DB is null', async () => {
      const noDbService = await buildService(false);
      await expect(noDbService.triggerManualCall('fee-uuid-001')).rejects.toThrow(
        'Database not configured',
      );
    });

    it('throws when fee record is not found in risk view', async () => {
      mockQuery.mockResolvedValueOnce([]); // empty rows
      await expect(service.triggerManualCall('fee-uuid-999')).rejects.toThrow(
        'Fee record not found in risk view',
      );
    });

    it('returns rate-limited message when INSERT returns no rows (cooldown active)', async () => {
      const fee = makeFeeRow();
      mockQuery
        .mockResolvedValueOnce([fee])   // SELECT from fee_risk_scores
        .mockResolvedValueOnce([]);      // INSERT returns [] → another call in last 10 min

      const result = await service.triggerManualCall('fee-uuid-001');

      expect(result.message).toContain('already initiated');
      expect(mockMessaging.triggerFeeCall).not.toHaveBeenCalled();
    });

    it('triggers voice call and returns success message when INSERT succeeds', async () => {
      const fee = makeFeeRow({ language: 'hi', parent_phone: '+919876543210' });
      mockQuery
        .mockResolvedValueOnce([fee])                         // SELECT
        .mockResolvedValueOnce([{ id: 'rem-inserted-1' }]);  // INSERT RETURNING id

      mockMessaging.triggerFeeCall.mockResolvedValueOnce('call-uuid-xyz');

      const result = await service.triggerManualCall('fee-uuid-001');

      expect(result.message).toBe('Call initiated successfully');
      expect(mockMessaging.triggerFeeCall).toHaveBeenCalledWith(
        '1RV21CS001',
        '+919876543210',
        'hi',
        expect.objectContaining({
          feeType: 'TUITION',
          balance: 45000,
        }),
      );
    });

    it('uses "en" language fallback when fee.language is empty string', async () => {
      const fee = makeFeeRow({ language: '' });
      mockQuery
        .mockResolvedValueOnce([fee])
        .mockResolvedValueOnce([{ id: 'rem-lang-fallback' }]);

      mockMessaging.triggerFeeCall.mockResolvedValueOnce('call-lang');

      await service.triggerManualCall('fee-uuid-001');

      expect(mockMessaging.triggerFeeCall).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'en',
        expect.anything(),
      );
    });

    it('dueDate is formatted as YYYY-MM-DD ISO slice (locale-independent)', async () => {
      const fee = makeFeeRow({ due_date: new Date('2025-06-30') });
      mockQuery
        .mockResolvedValueOnce([fee])
        .mockResolvedValueOnce([{ id: 'rem-date-check' }]);
      mockMessaging.triggerFeeCall.mockResolvedValueOnce('call-date');

      await service.triggerManualCall('fee-uuid-001');

      const callArgs = mockMessaging.triggerFeeCall.mock.calls[0];
      expect(callArgs[3].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('updates reminder status to FAILED and rethrows when triggerFeeCall fails', async () => {
      const fee = makeFeeRow();
      mockQuery
        .mockResolvedValueOnce([fee])
        .mockResolvedValueOnce([{ id: 'rem-fail-id' }])  // INSERT succeeds
        .mockResolvedValueOnce([]);                        // UPDATE status=FAILED

      mockMessaging.triggerFeeCall.mockRejectedValueOnce(new Error('Voice service down'));

      await expect(service.triggerManualCall('fee-uuid-001')).rejects.toThrow(
        'Voice service down',
      );

      // UPDATE is the last query call — params are [insertedId, notes]
      const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
      expect(lastCall[0]).toContain('FAILED');
      expect(lastCall[1][1]).toBe('Voice service down');
    });

    it('truncates long error messages to 500 chars when updating FAILED status', async () => {
      const fee = makeFeeRow();
      const longError = 'E'.repeat(600);
      mockQuery
        .mockResolvedValueOnce([fee])
        .mockResolvedValueOnce([{ id: 'rem-long-err' }])
        .mockResolvedValueOnce([]);

      mockMessaging.triggerFeeCall.mockRejectedValueOnce(new Error(longError));

      await expect(service.triggerManualCall('fee-uuid-001')).rejects.toThrow();

      const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
      const savedNotes = lastCall[1][1] as string;
      expect(savedNotes.length).toBeLessThanOrEqual(500);
    });

    it('non-Error thrown — message ?? "" fallback used for notes', async () => {
      const fee = makeFeeRow();
      mockQuery
        .mockResolvedValueOnce([fee])
        .mockResolvedValueOnce([{ id: 'rem-manual-nonerr' }])
        .mockResolvedValueOnce([]);

      mockMessaging.triggerFeeCall.mockRejectedValueOnce({ code: 'ETIMEDOUT' });

      await expect(service.triggerManualCall('fee-uuid-001')).rejects.toEqual({ code: 'ETIMEDOUT' });

      const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
      expect(lastCall[1]).toEqual(['rem-manual-nonerr', '']);
    });
  });

  // ─── runNightlyReminderChain ─────────────────────────────────────────────

  describe('runNightlyReminderChain()', () => {
    it('returns early and warns when DB is null', async () => {
      const noDbService = await buildService(false);
      const warnSpy = jest.spyOn((noDbService as any).logger, 'warn');

      await noDbService.runNightlyReminderChain();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No DB'));
    });

    it('logs starting and completing chain', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.runNightlyReminderChain();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Starting nightly'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Chain complete'));
    });

    it('logs count of fees in reminder window', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.runNightlyReminderChain();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('0 fees in reminder window'),
      );
    });

    it('processes empty fee list without error and logs 0/0', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.runNightlyReminderChain();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('0/0'));
    });

    it('processes all fees successfully and reports correct sent count', async () => {
      const fees = [
        makeFeeRow({ fee_payment_id: 'fee-001', risk_level: 'HIGH', days_to_due: 10 }),
        makeFeeRow({ fee_payment_id: 'fee-002', risk_level: 'MEDIUM', days_to_due: 5, language: 'en' }),
      ];

      mockQuery
        .mockResolvedValueOnce(fees)                         // main SELECT
        .mockResolvedValueOnce([{ id: 'rem-001' }])          // INSERT fee-001 → claimed
        .mockResolvedValueOnce([{ id: 'rem-002' }]);         // INSERT fee-002 → claimed

      mockMessaging.sendWhatsApp.mockResolvedValue('SM_ok');

      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.runNightlyReminderChain();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2/2'));
    });

    it('does not abort chain when one fee processing fails; others succeed', async () => {
      const fees = [
        makeFeeRow({ fee_payment_id: 'fee-001', risk_level: 'HIGH', days_to_due: 10 }),
        makeFeeRow({ fee_payment_id: 'fee-002', risk_level: 'HIGH', days_to_due: 10 }),
      ];

      mockQuery
        .mockResolvedValueOnce(fees)                          // main SELECT
        .mockResolvedValueOnce([{ id: 'rem-001' }])           // INSERT fee-001 → claimed
        .mockResolvedValueOnce([])                            // UPDATE FAILED for fee-001
        .mockResolvedValueOnce([{ id: 'rem-002' }]);          // INSERT fee-002 → claimed

      mockMessaging.sendWhatsApp
        .mockRejectedValueOnce(new Error('Twilio timeout'))  // fee-001 fails
        .mockResolvedValueOnce('SM_ok');                      // fee-002 succeeds

      const errorSpy = jest.spyOn((service as any).logger, 'error');
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.runNightlyReminderChain();

      // Error logged for failed fee with usn= prefix (no PII)
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/usn=|feeId=/),
      );
      // Only 1 succeeded
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1/2'));
    });
  });

  // ─── processReminder — risk level + reminder type branches ───────────────

  describe('processReminder() — risk level and reminder type branching', () => {
    // ── HIGH risk ──────────────────────────────────────────────────────────

    it('sends WHATSAPP_10D via sendWhatsApp for HIGH risk when daysLeft=10', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10 });
      setupNightlyWithFee(fee, [{ id: 'rem-hi-10' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_hi_10');

      await service.runNightlyReminderChain();

      expect(mockMessaging.sendWhatsApp).toHaveBeenCalledTimes(1);
      const [, insertParams] = mockQuery.mock.calls[1];
      expect(insertParams).toContain('WHATSAPP_10D');
      expect(insertParams).toContain('WHATSAPP');
    });

    it('sends WHATSAPP_10D for HIGH risk when daysLeft=9 (boundary)', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 9 });
      setupNightlyWithFee(fee, [{ id: 'rem-hi-9' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_hi_9');

      await service.runNightlyReminderChain();

      expect(mockMessaging.sendWhatsApp).toHaveBeenCalledTimes(1);
      const [, insertParams] = mockQuery.mock.calls[1];
      expect(insertParams).toContain('WHATSAPP_10D');
    });

    it('sends CALL_5D via triggerFeeCall for HIGH risk when daysLeft=5', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 5 });
      setupNightlyWithFee(fee, [{ id: 'rem-hi-5' }]);
      mockMessaging.triggerFeeCall.mockResolvedValueOnce('call-hi-5');

      await service.runNightlyReminderChain();

      expect(mockMessaging.triggerFeeCall).toHaveBeenCalledTimes(1);
      const [, insertParams] = mockQuery.mock.calls[1];
      expect(insertParams).toContain('CALL_5D');
      expect(insertParams).toContain('VOICE');
    });

    it('sends CALL_5D for HIGH risk when daysLeft=4 (boundary)', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 4 });
      setupNightlyWithFee(fee, [{ id: 'rem-hi-4' }]);
      mockMessaging.triggerFeeCall.mockResolvedValueOnce('call-hi-4');

      await service.runNightlyReminderChain();

      expect(mockMessaging.triggerFeeCall).toHaveBeenCalledTimes(1);
      const [, insertParams] = mockQuery.mock.calls[1];
      expect(insertParams).toContain('CALL_5D');
    });

    it('sends CALL_1D via triggerFeeCall for HIGH risk when daysLeft=1', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 1 });
      setupNightlyWithFee(fee, [{ id: 'rem-hi-1' }]);
      mockMessaging.triggerFeeCall.mockResolvedValueOnce('call-hi-1');

      await service.runNightlyReminderChain();

      expect(mockMessaging.triggerFeeCall).toHaveBeenCalledTimes(1);
      const [, insertParams] = mockQuery.mock.calls[1];
      expect(insertParams).toContain('CALL_1D');
    });

    it('sends CALL_1D for HIGH risk when daysLeft=0 (due today — lower boundary)', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 0 });
      setupNightlyWithFee(fee, [{ id: 'rem-hi-0' }]);
      mockMessaging.triggerFeeCall.mockResolvedValueOnce('call-hi-0');

      await service.runNightlyReminderChain();

      expect(mockMessaging.triggerFeeCall).toHaveBeenCalledTimes(1);
      const [, insertParams] = mockQuery.mock.calls[1];
      expect(insertParams).toContain('CALL_1D');
    });

    it('returns early (no reminder) for HIGH risk when daysLeft=7 (no-match-day)', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 7 });
      mockQuery.mockResolvedValueOnce([fee]); // main SELECT only — INSERT never reached

      await service.runNightlyReminderChain();

      expect(mockQuery).toHaveBeenCalledTimes(1); // only main SELECT
      expect(mockMessaging.sendWhatsApp).not.toHaveBeenCalled();
      expect(mockMessaging.triggerFeeCall).not.toHaveBeenCalled();
    });

    // ── MEDIUM risk ────────────────────────────────────────────────────────

    it('sends WHATSAPP_10D (channel=WHATSAPP) for MEDIUM risk when daysLeft=5', async () => {
      const fee = makeFeeRow({ risk_level: 'MEDIUM', days_to_due: 5 });
      setupNightlyWithFee(fee, [{ id: 'rem-med-5' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_med_5');

      await service.runNightlyReminderChain();

      expect(mockMessaging.sendWhatsApp).toHaveBeenCalledTimes(1);
      const [, insertParams] = mockQuery.mock.calls[1];
      expect(insertParams).toContain('WHATSAPP_10D');
      expect(insertParams).toContain('WHATSAPP');
    });

    it('sends WHATSAPP_10D for MEDIUM risk when daysLeft=4 (boundary)', async () => {
      const fee = makeFeeRow({ risk_level: 'MEDIUM', days_to_due: 4 });
      setupNightlyWithFee(fee, [{ id: 'rem-med-4' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_med_4');

      await service.runNightlyReminderChain();

      expect(mockMessaging.sendWhatsApp).toHaveBeenCalledTimes(1);
    });

    it('sends SMS_2D via sendSms for MEDIUM risk when daysLeft=1', async () => {
      const fee = makeFeeRow({ risk_level: 'MEDIUM', days_to_due: 1 });
      setupNightlyWithFee(fee, [{ id: 'rem-med-sms-1' }]);
      mockMessaging.sendSms.mockResolvedValueOnce('SM_med_sms_1');

      await service.runNightlyReminderChain();

      expect(mockMessaging.sendSms).toHaveBeenCalledTimes(1);
      const [, insertParams] = mockQuery.mock.calls[1];
      expect(insertParams).toContain('SMS_2D');
      expect(insertParams).toContain('SMS');
    });

    it('sends SMS_2D for MEDIUM risk when daysLeft=0 (due today)', async () => {
      const fee = makeFeeRow({ risk_level: 'MEDIUM', days_to_due: 0 });
      setupNightlyWithFee(fee, [{ id: 'rem-med-sms-0' }]);
      mockMessaging.sendSms.mockResolvedValueOnce('SM_med_0');

      await service.runNightlyReminderChain();

      expect(mockMessaging.sendSms).toHaveBeenCalledTimes(1);
    });

    it('returns early for MEDIUM risk when daysLeft=7 (no-match-day)', async () => {
      const fee = makeFeeRow({ risk_level: 'MEDIUM', days_to_due: 7 });
      mockQuery.mockResolvedValueOnce([fee]);

      await service.runNightlyReminderChain();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockMessaging.sendWhatsApp).not.toHaveBeenCalled();
      expect(mockMessaging.sendSms).not.toHaveBeenCalled();
    });

    // ── LOW risk ───────────────────────────────────────────────────────────

    it('sends SMS_2D via sendSms for LOW risk when daysLeft=2', async () => {
      const fee = makeFeeRow({ risk_level: 'LOW', days_to_due: 2 });
      setupNightlyWithFee(fee, [{ id: 'rem-low-2' }]);
      mockMessaging.sendSms.mockResolvedValueOnce('SM_low_2');

      await service.runNightlyReminderChain();

      expect(mockMessaging.sendSms).toHaveBeenCalledTimes(1);
      const [, insertParams] = mockQuery.mock.calls[1];
      expect(insertParams).toContain('SMS_2D');
    });

    it('sends SMS_2D for LOW risk when daysLeft=1 (boundary)', async () => {
      const fee = makeFeeRow({ risk_level: 'LOW', days_to_due: 1 });
      setupNightlyWithFee(fee, [{ id: 'rem-low-1' }]);
      mockMessaging.sendSms.mockResolvedValueOnce('SM_low_1');

      await service.runNightlyReminderChain();

      expect(mockMessaging.sendSms).toHaveBeenCalledTimes(1);
    });

    it('returns early for LOW risk when daysLeft=5 (no-match-day)', async () => {
      const fee = makeFeeRow({ risk_level: 'LOW', days_to_due: 5 });
      mockQuery.mockResolvedValueOnce([fee]);

      await service.runNightlyReminderChain();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockMessaging.sendSms).not.toHaveBeenCalled();
    });

    // ── Idempotency (atomic INSERT ON CONFLICT returns []) ─────────────────

    it('skips send when INSERT ON CONFLICT returns [] (dedup hit)', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10 });
      mockQuery
        .mockResolvedValueOnce([fee])  // main SELECT
        .mockResolvedValueOnce([]);    // INSERT returns [] — already claimed

      const debugSpy = jest.spyOn((service as any).logger, 'debug');

      await service.runNightlyReminderChain();

      expect(mockMessaging.sendWhatsApp).not.toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Dedup'));
    });

    // ── Failure path: send fails → mark FAILED → rethrow ──────────────────

    it('updates reminder status to FAILED when WhatsApp send fails', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10 });
      setupNightlyWithFee(fee, [{ id: 'rem-fail-wa' }], true);
      mockMessaging.sendWhatsApp.mockRejectedValueOnce(new Error('Network timeout'));

      await service.runNightlyReminderChain();

      // UPDATE is the last query call — params[1] holds the error notes
      const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
      expect(lastCall[0]).toContain('FAILED');
      expect(lastCall[1][1]).toContain('Network timeout');
    });

    it('updates reminder status to FAILED when voice call fails', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 5 });
      setupNightlyWithFee(fee, [{ id: 'rem-fail-voice' }], true);
      mockMessaging.triggerFeeCall.mockRejectedValueOnce(new Error('Voice service down'));

      await service.runNightlyReminderChain();

      const updateCall = mockQuery.mock.calls.find(
        ([sql]: [string]) => typeof sql === 'string' && sql.includes('FAILED'),
      );
      expect(updateCall).toBeDefined();
    });

    it('updates reminder status to FAILED when SMS send fails', async () => {
      const fee = makeFeeRow({ risk_level: 'LOW', days_to_due: 2 });
      setupNightlyWithFee(fee, [{ id: 'rem-fail-sms' }], true);
      mockMessaging.sendSms.mockRejectedValueOnce(new Error('SMS gateway error'));

      await service.runNightlyReminderChain();

      const updateCall = mockQuery.mock.calls.find(
        ([sql]: [string]) => typeof sql === 'string' && sql.includes('FAILED'),
      );
      expect(updateCall).toBeDefined();
    });

    it('truncates long send-failure error notes to 500 chars', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10 });
      setupNightlyWithFee(fee, [{ id: 'rem-long-err' }], true);
      mockMessaging.sendWhatsApp.mockRejectedValueOnce(new Error('E'.repeat(600)));

      await service.runNightlyReminderChain();

      const updateCall = mockQuery.mock.calls.find(
        ([sql]: [string]) => typeof sql === 'string' && sql.includes('FAILED'),
      );
      const savedNotes = updateCall![1][1] as string;
      expect(savedNotes.length).toBeLessThanOrEqual(500);
    });

    it('logs dispatch with usn and feeId — no parent_phone logged (DPDP compliance)', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10 });
      setupNightlyWithFee(fee, [{ id: 'rem-dpdp' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_ok');
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.runNightlyReminderChain();

      const dispatchLog = (logSpy.mock.calls as string[][]).find(
        ([msg]) => msg.includes('dispatched'),
      );
      expect(dispatchLog).toBeDefined();
      expect(dispatchLog![0]).not.toContain('+919876543210');
    });

    // ── WA template language branches ──────────────────────────────────────

    it('uses Kannada (kn) WhatsApp template', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10, language: 'kn' });
      setupNightlyWithFee(fee, [{ id: 'rem-kn' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_kn');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendWhatsApp.mock.calls[0][1];
      expect(msg).toContain('ನಮಸ್ಕಾರ');
    });

    it('uses Hindi (hi) WhatsApp template', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10, language: 'hi' });
      setupNightlyWithFee(fee, [{ id: 'rem-hi' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_hi_tmpl');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendWhatsApp.mock.calls[0][1];
      expect(msg).toContain('नमस्ते');
    });

    it('uses Tamil (ta) WhatsApp template', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10, language: 'ta' });
      setupNightlyWithFee(fee, [{ id: 'rem-ta' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_ta');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendWhatsApp.mock.calls[0][1];
      expect(msg).toContain('வணக்கம்');
    });

    it('uses Telugu (te) WhatsApp template', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10, language: 'te' });
      setupNightlyWithFee(fee, [{ id: 'rem-te' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_te');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendWhatsApp.mock.calls[0][1];
      expect(msg).toContain('నమస్కారం');
    });

    it('uses English (en) WhatsApp template for en language', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10, language: 'en' });
      setupNightlyWithFee(fee, [{ id: 'rem-en' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_en');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendWhatsApp.mock.calls[0][1];
      expect(msg).toContain('Dear');
    });

    it('falls back to English WA template for unknown language (e.g. ml)', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10, language: 'ml' });
      setupNightlyWithFee(fee, [{ id: 'rem-ml-fallback' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_ml_fallback');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendWhatsApp.mock.calls[0][1];
      expect(msg).toContain('Dear'); // English fallback
    });

    it('falls back to English WA template when language is empty string', async () => {
      // language '' → lang = 'en' (due to || 'en' in processReminder)
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10, language: '' });
      setupNightlyWithFee(fee, [{ id: 'rem-empty-lang' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_empty');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendWhatsApp.mock.calls[0][1];
      expect(msg).toContain('Dear');
    });

    // ── SMS template language branches ──────────────────────────────────────

    it('uses Kannada (kn) SMS template', async () => {
      const fee = makeFeeRow({ risk_level: 'LOW', days_to_due: 2, language: 'kn' });
      setupNightlyWithFee(fee, [{ id: 'rem-sms-kn' }]);
      mockMessaging.sendSms.mockResolvedValueOnce('SM_kn_sms');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendSms.mock.calls[0][1];
      expect(msg).toContain('ಶುಲ್ಕ');
    });

    it('uses Hindi (hi) SMS template', async () => {
      const fee = makeFeeRow({ risk_level: 'LOW', days_to_due: 2, language: 'hi' });
      setupNightlyWithFee(fee, [{ id: 'rem-sms-hi' }]);
      mockMessaging.sendSms.mockResolvedValueOnce('SM_hi_sms');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendSms.mock.calls[0][1];
      expect(msg).toContain('फीस');
    });

    it('uses English (en) SMS template', async () => {
      const fee = makeFeeRow({ risk_level: 'LOW', days_to_due: 2, language: 'en' });
      setupNightlyWithFee(fee, [{ id: 'rem-sms-en' }]);
      mockMessaging.sendSms.mockResolvedValueOnce('SM_en_sms');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendSms.mock.calls[0][1];
      expect(msg).toContain('Dear');
    });

    it('falls back to English SMS template for language not in SMS_TEMPLATES (e.g. te)', async () => {
      const fee = makeFeeRow({ risk_level: 'LOW', days_to_due: 2, language: 'te' });
      setupNightlyWithFee(fee, [{ id: 'rem-sms-te-fallback' }]);
      mockMessaging.sendSms.mockResolvedValueOnce('SM_te_fallback');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendSms.mock.calls[0][1];
      expect(msg).toContain('Dear'); // English fallback
    });

    // ── ERP edge: academic year boundary — daysLeft=-1 (one day overdue) ──

    it('ERP: daysLeft=-1 (one day overdue) — no branch matches, returns early', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: -1 });
      mockQuery.mockResolvedValueOnce([fee]);

      await service.runNightlyReminderChain();

      expect(mockQuery).toHaveBeenCalledTimes(1); // only main SELECT
      expect(mockMessaging.triggerFeeCall).not.toHaveBeenCalled();
    });

    // ── ERP edge: concurrent payment / race condition ──────────────────────

    it('ERP: concurrent sends — second row deduplicated by atomic INSERT ON CONFLICT', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10 });
      mockQuery
        .mockResolvedValueOnce([fee, fee])   // TWO identical rows (race scenario)
        .mockResolvedValueOnce([{ id: 'rem-first' }])  // first fee → INSERT succeeds
        .mockResolvedValueOnce([]);                      // second fee → INSERT returns [] (dedup)

      mockMessaging.sendWhatsApp.mockResolvedValue('SM_race');

      await service.runNightlyReminderChain();

      // Only one actual WhatsApp send despite two rows
      expect(mockMessaging.sendWhatsApp).toHaveBeenCalledTimes(1);
    });

    // ── ERP edge: balance coercion from DB string ──────────────────────────

    it('ERP: balance coerced from string when DB returns string type', async () => {
      const fee = makeFeeRow({
        risk_level: 'HIGH',
        days_to_due: 10,
        balance: '45000.50' as unknown as number,
      });
      setupNightlyWithFee(fee, [{ id: 'rem-coerce' }]);
      mockMessaging.sendWhatsApp.mockResolvedValueOnce('SM_coerce');

      await service.runNightlyReminderChain();

      const msg: string = mockMessaging.sendWhatsApp.mock.calls[0][1];
      // Number('45000.50') → 45000.5 → renders as "45,000.5" or similar, not NaN or object
      expect(msg).not.toContain('NaN');
      expect(msg).not.toContain('[object');
    });

    // ── processReminder null-DB internal guard ─────────────────────────────

    it('processReminder guard: no-DB service — chain skips before processReminder is called', async () => {
      const noDbService = await buildService(false);

      await noDbService.runNightlyReminderChain();

      // With no DB, chain returns before any query or messaging
      expect(mockMessaging.sendWhatsApp).not.toHaveBeenCalled();
      expect(mockMessaging.sendSms).not.toHaveBeenCalled();
      expect(mockMessaging.triggerFeeCall).not.toHaveBeenCalled();
    });

    it('processReminder: null-DB guard returns early when called directly', async () => {
      const noDbService = await buildService(false);

      await (noDbService as any).processReminder(makeFeeRow());

      expect(mockMessaging.sendWhatsApp).not.toHaveBeenCalled();
      expect(mockMessaging.sendSms).not.toHaveBeenCalled();
      expect(mockMessaging.triggerFeeCall).not.toHaveBeenCalled();
    });

    it('processReminder: non-Error thrown — message ?? "" fallback used for notes', async () => {
      const fee = makeFeeRow({ risk_level: 'HIGH', days_to_due: 10 });
      setupNightlyWithFee(fee, [{ id: 'rem-nonerr' }], false);
      mockMessaging.sendWhatsApp.mockRejectedValueOnce({ code: 'ECONNREFUSED' });
      mockQuery.mockResolvedValueOnce([]); // UPDATE status=FAILED

      await service.runNightlyReminderChain();

      const updateCall = mockQuery.mock.calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('UPDATE fee_reminders'),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![1]).toEqual(['rem-nonerr', '']);
    });
  });

  // ─── validateVoiceServiceUrl (SSRF guard — tested via constructor) ────────

  describe('validateVoiceServiceUrl (constructor SSRF guard)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('accepts a valid http:// URL', async () => {
      process.env['VOICE_SERVICE_URL'] = 'http://localhost:8080';
      await expect(buildService(false)).resolves.toBeDefined();
    });

    it('accepts a valid https:// URL', async () => {
      process.env['VOICE_SERVICE_URL'] = 'https://voice.internal';
      await expect(buildService(false)).resolves.toBeDefined();
    });

    it('throws for ftp:// protocol (non-http/https)', async () => {
      process.env['VOICE_SERVICE_URL'] = 'ftp://localhost:8080';
      await expect(buildService(false)).rejects.toThrow('must be http or https');
    });

    it('throws for 169.254.169.254 (cloud metadata SSRF)', async () => {
      process.env['VOICE_SERVICE_URL'] = 'http://169.254.169.254/';
      await expect(buildService(false)).rejects.toThrow('restricted address');
    });

    it('throws for 169.254.x.x range (link-local SSRF)', async () => {
      process.env['VOICE_SERVICE_URL'] = 'http://169.254.1.1/';
      await expect(buildService(false)).rejects.toThrow('restricted address');
    });

    it('throws for metadata.google.internal', async () => {
      process.env['VOICE_SERVICE_URL'] = 'http://metadata.google.internal/';
      await expect(buildService(false)).rejects.toThrow('restricted address');
    });

    it('throws for an invalid non-URL string', async () => {
      process.env['VOICE_SERVICE_URL'] = 'not-a-url';
      await expect(buildService(false)).rejects.toThrow();
    });
  });

  // ─── validateVoiceServiceUrl (direct unit — covers TypeError branch) ──────

  describe('validateVoiceServiceUrl() — direct invocation', () => {
    it('throws a wrapped Error for an invalid URL string (TypeError path)', () => {
      expect(() => validateVoiceServiceUrl('not-a-url')).toThrow('not a valid URL');
    });

    it('does not throw for valid http URL', () => {
      expect(() => validateVoiceServiceUrl('http://localhost:9000')).not.toThrow();
    });

    it('does not throw for valid https URL', () => {
      expect(() => validateVoiceServiceUrl('https://voice.internal')).not.toThrow();
    });
  });
});
