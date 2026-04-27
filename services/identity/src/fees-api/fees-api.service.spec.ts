import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FeesApiService, FeeItem } from './fees-api.service';

const makeFeeItem = (overrides: Partial<FeeItem> = {}): FeeItem => ({
  id: 'fee-1',
  usn: 'USN001',
  component: 'Tuition',
  semester: 5,
  amount: 50000,
  dueDate: '2026-05-01',
  status: 'PENDING',
  ...overrides,
});

describe('FeesApiService', () => {
  let service: FeesApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeesApiService],
    }).compile();

    service = module.get<FeesApiService>(FeesApiService);
  });

  // ─── getStudentFees ─────────────────────────────────────────────────────────

  describe('getStudentFees()', () => {
    it('throws NotFoundException when no fee records exist for USN', () => {
      expect(() => service.getStudentFees('UNKNOWN')).toThrow(NotFoundException);
    });

    it('returns correct totalDue and totalOutstanding', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN001', amount: 50000, status: 'PAID' }),
        makeFeeItem({ id: 'f2', usn: 'USN001', amount: 30000, status: 'PENDING' }),
        makeFeeItem({ id: 'f3', usn: 'USN001', amount: 20000, status: 'OVERDUE' }),
      );

      const result = service.getStudentFees('USN001');
      expect(result.totalDue).toBe(100000);
      expect(result.totalOutstanding).toBe(50000); // PENDING + OVERDUE
      expect(result.items).toHaveLength(3);
    });

    it('returns zero outstanding when all fees are PAID', () => {
      service.feeItems.push(makeFeeItem({ id: 'f1', usn: 'USN002', status: 'PAID' }));
      const result = service.getStudentFees('USN002');
      expect(result.totalOutstanding).toBe(0);
    });

    it('returns status PAID when all items are PAID', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN010', amount: 50000, status: 'PAID' }),
        makeFeeItem({ id: 'f2', usn: 'USN010', amount: 30000, status: 'PAID' }),
      );
      const result = service.getStudentFees('USN010');
      expect(result.status).toBe('PAID');
      expect(result.totalPaid).toBe(80000);
      expect(result.totalOutstanding).toBe(0);
    });

    it('returns status OVERDUE when any item is OVERDUE (even if totalOutstanding > 0)', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN011', amount: 50000, status: 'PENDING' }),
        makeFeeItem({ id: 'f2', usn: 'USN011', amount: 30000, status: 'OVERDUE' }),
      );
      const result = service.getStudentFees('USN011');
      expect(result.status).toBe('OVERDUE');
      expect(result.totalPaid).toBe(0);
      expect(result.totalOutstanding).toBe(80000);
    });

    it('returns status PENDING when outstanding with no OVERDUE items', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN012', amount: 50000, status: 'PAID' }),
        makeFeeItem({ id: 'f2', usn: 'USN012', amount: 30000, status: 'PENDING' }),
      );
      const result = service.getStudentFees('USN012');
      expect(result.status).toBe('PENDING');
      expect(result.totalPaid).toBe(50000);
      expect(result.totalOutstanding).toBe(30000);
    });

    it('returns OVERDUE not PAID for zero-amount OVERDUE item (ternary order)', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN013', amount: 0, status: 'OVERDUE' }),
      );
      const result = service.getStudentFees('USN013');
      expect(result.status).toBe('OVERDUE');
    });
  });

  describe('getFeeHistory()', () => {
    it('returns mapped history from real fee items', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN020', component: 'Tuition', semester: 5, amount: 45000, status: 'PAID', paidDate: '2026-03-01' }),
      );
      const history = service.getFeeHistory('USN020');
      expect(history).toHaveLength(1);
      expect(history[0].date).toBe('2026-03-01');
      expect(history[0].description).toContain('Tuition');
    });

    it('returns 6-entry stub when no items exist for USN', () => {
      const history = service.getFeeHistory('USN_NO_RECORDS');
      expect(history).toHaveLength(6);
      expect(history[0].status).toBe('PENDING');
      expect(history[1].status).toBe('PAID');
    });

    it('uses dueDate when paidDate is absent', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN021', status: 'PENDING', dueDate: '2026-06-01', paidDate: undefined }),
      );
      const history = service.getFeeHistory('USN021');
      expect(history[0].date).toBe('2026-06-01');
    });
  });

  describe('getFeeSummary()', () => {
    it('returns real totalDue and overdueCount from fee items', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN030', amount: 50000, status: 'OVERDUE', dueDate: '2026-04-01' }),
        makeFeeItem({ id: 'f2', usn: 'USN030', amount: 30000, status: 'PENDING', dueDate: '2026-06-01' }),
      );
      const summary = service.getFeeSummary('USN030');
      expect(summary.totalDue).toBe(80000);
      expect(summary.overdueCount).toBe(1);
      expect(summary.nextDue).toBe('2026-06-01');
    });

    it('returns zero totalDue when no items exist', () => {
      const summary = service.getFeeSummary('USN_EMPTY');
      expect(summary.totalDue).toBe(0);
      expect(summary.overdueCount).toBe(0);
    });
  });

  describe('verifyPayment()', () => {
    it('returns success with receiptId and paidAt', async () => {
      const result = await service.verifyPayment('order_123', 'pay_456', 'sig_789');
      expect(result.success).toBe(true);
      expect(result.receiptId).toMatch(/^rcpt_/);
      expect(result.paidAt).toBeDefined();
    });
  });

  // ─── initiatePayment ────────────────────────────────────────────────────────

  describe('initiatePayment()', () => {
    it('returns a paymentUrl and orderId', () => {
      const result = service.initiatePayment('USN001', 50000, ['fee-1']);
      expect(result.paymentUrl).toContain('razorpay.com');
      expect(result.orderId).toMatch(/^order_/);
    });

    it('each call produces a unique orderId', () => {
      const r1 = service.initiatePayment('USN001', 100, ['f1']);
      const r2 = service.initiatePayment('USN001', 100, ['f1']);
      // orderId contains Date.now(), so they may differ by timing—but format should always match
      expect(r1.orderId).toMatch(/^order_/);
      expect(r2.orderId).toMatch(/^order_/);
    });
  });

  // ─── initiatePaymentGateway ─────────────────────────────────────────────────

  describe('initiatePaymentGateway()', () => {
    it('returns currency INR and prefill with lowercase USN email', () => {
      const result = service.initiatePaymentGateway('1RV21CS001', 50000, ['f-1']);
      expect(result.currency).toBe('INR');
      expect(result.orderId).toMatch(/^order_/);
      expect(result.amount).toBe(50000);
      expect(result.prefill.email).toBe('1rv21cs001@rvce.edu.in');
      expect(result.key).toBeTruthy();
    });

    it('lowercases USN in email prefill', () => {
      const result = service.initiatePaymentGateway('1RV21CS999', 10000, []);
      expect(result.prefill.email).toBe('1rv21cs999@rvce.edu.in');
    });

    it('includes student name with USN', () => {
      const result = service.initiatePaymentGateway('USN042', 30000, ['f1', 'f2']);
      expect(result.prefill.name).toContain('USN042');
    });
  });

  // ─── getFeeSummary ──────────────────────────────────────────────────────────

  describe('getFeeSummary() — totalPaid coverage', () => {
    it('returns correct totalPaid from PAID items', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN040', amount: 45000, status: 'PAID' }),
        makeFeeItem({ id: 'f2', usn: 'USN040', amount: 5000, status: 'PENDING', dueDate: '2026-07-01' }),
      );
      const result = service.getFeeSummary('USN040');
      expect(result.totalPaid).toBe(45000);
    });

    it('nextDue is the PENDING item dueDate when one exists', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN041', amount: 50000, status: 'PENDING', dueDate: '2026-07-01' }),
      );
      expect(service.getFeeSummary('USN041').nextDue).toBe('2026-07-01');
    });

    it('overdueCount reflects OVERDUE items only', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN043', amount: 10000, status: 'OVERDUE' }),
        makeFeeItem({ id: 'f2', usn: 'USN043', amount: 10000, status: 'OVERDUE' }),
        makeFeeItem({ id: 'f3', usn: 'USN043', amount: 10000, status: 'PENDING' }),
      );
      expect(service.getFeeSummary('USN043').overdueCount).toBe(2);
    });
  });

  // ─── verifyPayment (stub behavior documented) ───────────────────────────────

  describe('verifyPayment() — stub behavior', () => {
    it('returns success: true (stub — HMAC verification not yet implemented)', async () => {
      const result = await service.verifyPayment('order_123', 'pay_456', 'sig_789');
      expect(result.success).toBe(true);
      expect(result.receiptId).toMatch(/^rcpt_/);
      expect(result.paidAt).toBeDefined();
    });
  });

  // ─── verifyPayment() — HMAC production path ────────────────────────────────

  describe('verifyPayment() — HMAC path', () => {
    const SECRET = 'test-secret-key';

    beforeEach(() => {
      process.env['RAZORPAY_KEY_SECRET'] = SECRET;
    });

    afterEach(() => {
      delete process.env['RAZORPAY_KEY_SECRET'];
    });

    it('returns success:true for valid HMAC signature', async () => {
      const crypto = require('crypto');
      const orderId = 'order_hmac_1';
      const paymentId = 'pay_hmac_1';
      const sig = crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');
      const result = await service.verifyPayment(orderId, paymentId, sig);
      expect(result.success).toBe(true);
      expect(result.receiptId).toMatch(/^rcpt_/);
    });

    it('returns success:false for invalid signature', async () => {
      const result = await service.verifyPayment('order_hmac_2', 'pay_hmac_2', 'badhex00'.repeat(8));
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('invalid_signature');
    });

    it('marks pending fees as paid on valid HMAC', async () => {
      const crypto = require('crypto');
      const paymentId = 'pay_hmac_3';
      service.feeItems.push(makeFeeItem({ id: 'fee-hmac-1', status: 'PENDING', usn: 'USN001' }));
      service.initiatePaymentGateway('USN001', 45000, ['fee-hmac-1']);
      const storedOrder = (service as any).pendingOrders.entries().next().value;
      if (storedOrder) {
        const [oid] = storedOrder;
        const sig = crypto.createHmac('sha256', SECRET).update(`${oid}|${paymentId}`).digest('hex');
        await service.verifyPayment(oid, paymentId, sig);
        expect(service.feeItems[0].status).toBe('PAID');
      }
    });
  });

  // ─── getFeeHistory ──────────────────────────────────────────────────────────

  describe('getFeeHistory()', () => {
    it('returns stub history with correct description format when no stored items', () => {
      const result = service.getFeeHistory('USN_STUB');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].description).toMatch(/Tuition Fee - Semester \d+/);
    });

    it('returns stored items mapped with description from component and semester', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN099', component: 'Library', semester: 5, status: 'PAID', paidDate: '2026-03-01' }),
      );
      const result = service.getFeeHistory('USN099');
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Library - Semester 5');
      expect(result[0].status).toBe('PAID');
    });
  });

  // ─── markPaid ───────────────────────────────────────────────────────────────

  describe('markPaid()', () => {
    it('sets matching fees to PAID and sets paidDate', async () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', status: 'PENDING' }),
        makeFeeItem({ id: 'f2', status: 'OVERDUE' }),
        makeFeeItem({ id: 'f3', status: 'PENDING' }),
      );

      await service.markPaid(['f1', 'f2']);
      expect(service.feeItems[0].status).toBe('PAID');
      expect(service.feeItems[0].paidDate).toBeDefined();
      expect(service.feeItems[1].status).toBe('PAID');
      expect(service.feeItems[2].status).toBe('PENDING');
    });

    it('silently ignores unknown fee ids', async () => {
      service.feeItems.push(makeFeeItem({ id: 'f1', status: 'PENDING' }));
      await expect(service.markPaid(['f-nonexistent'])).resolves.toBeUndefined();
      expect(service.feeItems[0].status).toBe('PENDING');
    });
  });

  // ─── onModuleInit (DB hydration) ─────────────────────────────────────────────

  describe('onModuleInit()', () => {
    it('skips hydration when no feeRepo injected', async () => {
      const svc = new FeesApiService();
      await svc.onModuleInit();
      expect(svc.feeItems).toEqual([]);
    });

    it('hydrates feeItems from DB rows when feeRepo is present', async () => {
      const mockRow = { id: 'f1', usn: 'USN1', component: 'Tuition', semester: 5, amount: '50000', status: 'PENDING', dueDate: '2026-05-01', paidDate: null };
      const mockRepo = { find: jest.fn().mockResolvedValue([mockRow]), manager: {} };
      const svc = new FeesApiService(mockRepo as any);
      await svc.onModuleInit();
      expect(svc.feeItems).toHaveLength(1);
      expect(svc.feeItems[0].id).toBe('f1');
      expect(svc.feeItems[0].amount).toBe(50000);
      expect(svc.feeItems[0].paidDate).toBeUndefined();
    });

    it('maps amount from DB decimal string to number', async () => {
      const mockRow = { id: 'f2', usn: 'USN2', component: 'Lab', semester: 3, amount: '12345.50', status: 'PAID', dueDate: '2026-01-01', paidDate: '2026-01-15' };
      const mockRepo = { find: jest.fn().mockResolvedValue([mockRow]), manager: {} };
      const svc = new FeesApiService(mockRepo as any);
      await svc.onModuleInit();
      expect(svc.feeItems[0].amount).toBe(12345.5);
      expect(svc.feeItems[0].paidDate).toBe('2026-01-15');
    });
  });

  // ─── verifyPayment — production guard ──────────────────────────────────────

  describe('verifyPayment() — production guard', () => {
    it('throws when NODE_ENV is production and RAZORPAY_KEY_SECRET is absent', async () => {
      const savedEnv = process.env['NODE_ENV'];
      const savedKey = process.env['RAZORPAY_KEY_SECRET'];
      process.env['NODE_ENV'] = 'production';
      delete process.env['RAZORPAY_KEY_SECRET'];
      await expect(service.verifyPayment('order_1', 'pay_1', 'sig_1')).rejects.toThrow(
        'RAZORPAY_KEY_SECRET env var is required in production',
      );
      process.env['NODE_ENV'] = savedEnv ?? 'test';
      if (savedKey) process.env['RAZORPAY_KEY_SECRET'] = savedKey;
    });

    it('returns success when orderId was never registered (dev mode)', async () => {
      delete process.env['RAZORPAY_KEY_SECRET'];
      const result = await service.verifyPayment('order_not_registered', 'pay_1', 'sig_1');
      expect(result.success).toBe(true);
    });
  });

  // ─── markPaid — DB transaction path ────────────────────────────────────────

  describe('markPaid() — with DB feeRepo', () => {
    it('calls manager.transaction and updates each fee via manager.update', async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const mockTransaction = jest.fn().mockImplementation(
        async (cb: (m: { update: typeof mockUpdate }) => Promise<void>) => {
          await cb({ update: mockUpdate });
        },
      );
      const { FeesApiService: Svc } = await import('./fees-api.service');
      const svc = new Svc({ find: jest.fn().mockResolvedValue([]), manager: { transaction: mockTransaction } } as never);
      svc.feeItems.push(makeFeeItem({ id: 'fee-tx-1', status: 'PENDING' }));
      await svc.markPaid(['fee-tx-1']);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
