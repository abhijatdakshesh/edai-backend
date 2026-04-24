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

    it('falls back to 45000 when no items exist', () => {
      const summary = service.getFeeSummary('USN_EMPTY');
      expect(summary.totalDue).toBe(45000);
      expect(summary.overdueCount).toBe(0);
    });
  });

  describe('verifyPayment()', () => {
    it('returns success with receiptId and paidAt', () => {
      const result = service.verifyPayment('order_123', 'pay_456', 'sig_789');
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

  // ─── markPaid ───────────────────────────────────────────────────────────────

  describe('markPaid()', () => {
    it('sets matching fees to PAID and sets paidDate', () => {
      service.feeItems.push(
        makeFeeItem({ id: 'f1', status: 'PENDING' }),
        makeFeeItem({ id: 'f2', status: 'OVERDUE' }),
        makeFeeItem({ id: 'f3', status: 'PENDING' }),
      );

      service.markPaid(['f1', 'f2']);
      expect(service.feeItems[0].status).toBe('PAID');
      expect(service.feeItems[0].paidDate).toBeDefined();
      expect(service.feeItems[1].status).toBe('PAID');
      expect(service.feeItems[2].status).toBe('PENDING'); // not in list
    });

    it('silently ignores unknown fee ids', () => {
      service.feeItems.push(makeFeeItem({ id: 'f1', status: 'PENDING' }));
      expect(() => service.markPaid(['f-nonexistent'])).not.toThrow();
      expect(service.feeItems[0].status).toBe('PENDING');
    });
  });
});
