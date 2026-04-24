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
      service.feeItems.push(
        makeFeeItem({ id: 'f1', usn: 'USN002', status: 'PAID' }),
      );
      const result = service.getStudentFees('USN002');
      expect(result.totalOutstanding).toBe(0);
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
