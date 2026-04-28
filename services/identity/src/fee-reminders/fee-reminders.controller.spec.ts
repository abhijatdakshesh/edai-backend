import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { BadRequestException } from '@nestjs/common';
import { FeeRemindersController } from './fee-reminders.controller';
import { FeeRemindersService } from './fee-reminders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { ROLES_KEY } from '../roles/roles.decorator';

// ─── Mock Service ─────────────────────────────────────────────────────────────

const mockSvc = {
  getDashboardSummary: jest.fn(),
  getOutstandingFees: jest.fn(),
  getReminderHistory: jest.fn(),
  triggerManualCall: jest.fn(),
};

// ─── Module builder ───────────────────────────────────────────────────────────

async function buildController(): Promise<{
  controller: FeeRemindersController;
  module: TestingModule;
}> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [FeeRemindersController],
    providers: [
      { provide: FeeRemindersService, useValue: mockSvc },
      Reflector,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const controller = module.get<FeeRemindersController>(FeeRemindersController);
  return { controller, module };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FeeRemindersController', () => {
  let controller: FeeRemindersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ controller } = await buildController());
  });

  // ─── Guard metadata verification ─────────────────────────────────────────

  describe('Guard metadata', () => {
    it('controller class has ROLES_KEY metadata with ADMIN, PRINCIPAL, HOD', () => {
      const roles: string[] = Reflect.getMetadata(ROLES_KEY, FeeRemindersController);
      expect(roles).toEqual(expect.arrayContaining(['ADMIN', 'PRINCIPAL', 'HOD']));
    });

    it('controller has JwtAuthGuard and RolesGuard applied via class-level metadata', () => {
      // Guards are registered by NestJS via __guards__ metadata key
      const guards = Reflect.getMetadata('__guards__', FeeRemindersController) ?? [];
      const guardNames = guards.map((g: { name?: string }) => g.name ?? g.toString());
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('RolesGuard');
    });
  });

  // ─── GET /fee-reminders/summary ─────────────────────────────────────────

  describe('getSummary()', () => {
    it('delegates to svc.getDashboardSummary and returns result', async () => {
      const summary = {
        total_outstanding_count: '5',
        high_risk_count: '2',
        total_outstanding_amount: '225000',
      };
      mockSvc.getDashboardSummary.mockResolvedValueOnce(summary);

      const result = controller.getSummary();

      expect(mockSvc.getDashboardSummary).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockSvc.getDashboardSummary.mock.results[0].value);
    });

    it('returns {} when service returns empty object (no-DB path)', async () => {
      mockSvc.getDashboardSummary.mockResolvedValueOnce({});

      const result = await controller.getSummary();
      expect(result).toEqual({});
    });
  });

  // ─── GET /fee-reminders/outstanding ─────────────────────────────────────

  describe('getOutstanding()', () => {
    it('delegates with all undefined when no query params supplied', () => {
      mockSvc.getOutstandingFees.mockResolvedValueOnce([]);

      controller.getOutstanding(undefined, undefined, undefined, 100);

      expect(mockSvc.getOutstandingFees).toHaveBeenCalledWith({
        riskLevel: undefined,
        department: undefined,
        overdueOnly: false,   // undefined === 'true' → false
        limit: 100,
      });
    });

    it('passes riskLevel and department filters through', () => {
      mockSvc.getOutstandingFees.mockResolvedValueOnce([]);

      controller.getOutstanding('HIGH', 'CSE', undefined, 50);

      expect(mockSvc.getOutstandingFees).toHaveBeenCalledWith({
        riskLevel: 'HIGH',
        department: 'CSE',
        overdueOnly: false,
        limit: 50,
      });
    });

    it('converts overdueOnly="true" to boolean true', () => {
      mockSvc.getOutstandingFees.mockResolvedValueOnce([]);

      controller.getOutstanding(undefined, undefined, 'true', 100);

      expect(mockSvc.getOutstandingFees).toHaveBeenCalledWith(
        expect.objectContaining({ overdueOnly: true }),
      );
    });

    it('converts overdueOnly="false" to boolean false', () => {
      mockSvc.getOutstandingFees.mockResolvedValueOnce([]);

      controller.getOutstanding(undefined, undefined, 'false', 100);

      expect(mockSvc.getOutstandingFees).toHaveBeenCalledWith(
        expect.objectContaining({ overdueOnly: false }),
      );
    });

    it('passes custom limit correctly', () => {
      mockSvc.getOutstandingFees.mockResolvedValueOnce([]);

      controller.getOutstanding(undefined, undefined, undefined, 25);

      expect(mockSvc.getOutstandingFees).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25 }),
      );
    });

    it('returns the service result directly', async () => {
      const fees = [{ fee_payment_id: 'fee-001' }];
      mockSvc.getOutstandingFees.mockResolvedValueOnce(fees);

      const result = controller.getOutstanding(undefined, undefined, undefined, 100);
      await expect(result).resolves.toEqual(fees);
    });

    it('returns [] when service returns empty array (no-DB or no matching fees)', async () => {
      mockSvc.getOutstandingFees.mockResolvedValueOnce([]);

      const result = await controller.getOutstanding(undefined, undefined, undefined, 100);
      expect(result).toEqual([]);
    });

    it('throws BadRequestException for invalid riskLevel', () => {
      expect(() => controller.getOutstanding('INVALID', undefined, undefined, 100))
        .toThrow(BadRequestException);
    });

    it('throws BadRequestException for department with invalid format', () => {
      expect(() => controller.getOutstanding(undefined, 'CSE-ECE', undefined, 100))
        .toThrow(BadRequestException);
    });

    it('clamps limit=0 to minimum of 1', () => {
      mockSvc.getOutstandingFees.mockResolvedValueOnce([]);
      controller.getOutstanding(undefined, undefined, undefined, 0);
      expect(mockSvc.getOutstandingFees).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1 }),
      );
    });

    it('clamps limit=999 to maximum of 500', () => {
      mockSvc.getOutstandingFees.mockResolvedValueOnce([]);
      controller.getOutstanding(undefined, undefined, undefined, 999);
      expect(mockSvc.getOutstandingFees).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 500 }),
      );
    });

    it('uses default limit of 100 when limit arg is omitted', () => {
      mockSvc.getOutstandingFees.mockResolvedValueOnce([]);
      controller.getOutstanding(undefined, undefined, undefined);
      expect(mockSvc.getOutstandingFees).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );
    });

    // ERP edge: MEDIUM risk overdue-only query for a department HOD
    it('ERP: combines all filters — risk+dept+overdue for HOD dashboard view', () => {
      mockSvc.getOutstandingFees.mockResolvedValueOnce([]);

      controller.getOutstanding('MEDIUM', 'ECE', 'true', 20);

      expect(mockSvc.getOutstandingFees).toHaveBeenCalledWith({
        riskLevel: 'MEDIUM',
        department: 'ECE',
        overdueOnly: true,
        limit: 20,
      });
    });
  });

  // ─── GET /fee-reminders/:feePaymentId/history ────────────────────────────

  describe('getReminderHistory()', () => {
    it('passes feePaymentId to service and returns result', async () => {
      const history = [
        { id: 'rem-001', reminder_type: 'WHATSAPP_10D', status: 'SENT' },
        { id: 'rem-002', reminder_type: 'CALL_5D', status: 'SENT' },
      ];
      mockSvc.getReminderHistory.mockResolvedValueOnce(history);

      const result = controller.getReminderHistory('fee-uuid-001');

      expect(mockSvc.getReminderHistory).toHaveBeenCalledWith('fee-uuid-001');
      expect(result).toBe(mockSvc.getReminderHistory.mock.results[0].value);
    });

    it('returns empty array when no history found', async () => {
      mockSvc.getReminderHistory.mockResolvedValueOnce([]);

      const result = await controller.getReminderHistory('fee-uuid-999');
      expect(result).toEqual([]);
    });

    it('passes feePaymentId in raw form without transformation', () => {
      mockSvc.getReminderHistory.mockResolvedValueOnce([]);

      controller.getReminderHistory('fee-special-id-456');

      expect(mockSvc.getReminderHistory).toHaveBeenCalledWith('fee-special-id-456');
    });
  });

  // ─── POST /fee-reminders/:feePaymentId/call-now ──────────────────────────

  describe('triggerCall()', () => {
    it('delegates to svc.triggerManualCall with the feePaymentId', async () => {
      const response = { message: 'Call initiated to +919876543210 for Ravi Kumar' };
      mockSvc.triggerManualCall.mockResolvedValueOnce(response);

      const result = controller.triggerCall('fee-uuid-001');

      expect(mockSvc.triggerManualCall).toHaveBeenCalledWith('fee-uuid-001');
      expect(result).toBe(mockSvc.triggerManualCall.mock.results[0].value);
    });

    it('propagates error from service when fee not found', async () => {
      mockSvc.triggerManualCall.mockRejectedValueOnce(
        new Error('Fee record not found in risk view'),
      );

      await expect(controller.triggerCall('fee-uuid-bad')).rejects.toThrow(
        'Fee record not found in risk view',
      );
    });

    it('propagates error from service when DB not configured', async () => {
      mockSvc.triggerManualCall.mockRejectedValueOnce(
        new Error('Database not configured'),
      );

      await expect(controller.triggerCall('fee-uuid-001')).rejects.toThrow(
        'Database not configured',
      );
    });

    it('returns the message from service on successful call trigger', async () => {
      mockSvc.triggerManualCall.mockResolvedValueOnce({
        message: 'Call initiated to +919876543210 for Priya Sharma',
      });

      const result = await controller.triggerCall('fee-uuid-002');
      expect(result).toMatchObject({
        message: expect.stringContaining('Call initiated'),
      });
    });
  });
});
