/**
 * fees.integration.spec.ts
 *
 * Integration tests for FeesService — exercises cross-method workflows using
 * the real in-memory store (no DB, no service mocks).
 *
 * Scenarios:
 *   1. Full payment workflow: PENDING → PARTIAL (first payment) → PAID (second payment)
 *   2. Student isolation: payment for student-A does not affect student-B records
 *   3. findById after payment reflects updated state
 */

import { NotFoundException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { FeesService } from './fees.service';
import type { FeeRecord } from '../entities/fee.entity';

// Silence NestJS logger output
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

// ─── constants ────────────────────────────────────────────────────────────────

/** Pre-seeded fee record id in FeesService */
const SEED_FEE_ID = 'fee-1';
const SEED_STUDENT_ID = 's-1';
const SEED_TOTAL_DUE = 85000;

// ─── helpers ─────────────────────────────────────────────────────────────────

let txnCounter = 0;
function uniqueTxn(prefix = 'txn'): string {
  return `${prefix}-${++txnCounter}-${Date.now()}`;
}

/**
 * Inject a brand-new FeeRecord into the service's private records array.
 * Used to set up multi-student scenarios without depending on seed state.
 */
function injectFeeRecord(
  service: FeesService,
  id: string,
  studentId: string,
  totalDue: number,
): void {
  (service as any).records.push({
    id,
    studentId,
    institutionId: 'rvce',
    academicYear: '2025-26',
    semester: 5,
    totalDue,
    totalPaid: 0,
    status: 'PENDING',
    payments: [],
    createdAt: new Date().toISOString(),
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Full payment workflow', () => {
  let service: FeesService;

  beforeEach(() => {
    service = new FeesService();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 1 — partial → PAID state machine + payment history integrity
  // ════════════════════════════════════════════════════════════════════════════

  it('partial payment → PARTIAL status → second payment → PAID status, history has 2 entries', () => {
    // Fee of 10 000 (inject a dedicated record so test does not rely on seed amount)
    const feeId = 'int-fee-10k';
    injectFeeRecord(service, feeId, 'int-stu-pay', 10000);

    // Step 1: pay 5000 → PARTIAL
    const afterFirst = service.recordPayment({
      feeRecordId: feeId,
      amount: 5000,
      mode: 'RAZORPAY',
      transactionRef: uniqueTxn('p1'),
    });

    expect(afterFirst.status).toBe('PARTIAL');
    expect(afterFirst.totalPaid).toBe(5000);
    expect(afterFirst.payments).toHaveLength(1);

    // Step 2: pay remaining 5000 → PAID
    const afterSecond = service.recordPayment({
      feeRecordId: feeId,
      amount: 5000,
      mode: 'NEFT',
      transactionRef: uniqueTxn('p2'),
    });

    expect(afterSecond.status).toBe('PAID');
    expect(afterSecond.totalPaid).toBe(10000);

    // Step 3: payment history has exactly 2 entries
    expect(afterSecond.payments).toHaveLength(2);

    // Step 4: findById also reflects the final state
    const retrieved = service.findById(feeId);
    expect(retrieved.totalPaid).toBe(10000);
    expect(retrieved.status).toBe('PAID');
    expect(retrieved.payments).toHaveLength(2);
  });

  it('three partial payments accumulate correctly before reaching PAID', () => {
    const feeId = 'int-fee-triple';
    injectFeeRecord(service, feeId, 'int-stu-triple', 9000);

    service.recordPayment({ feeRecordId: feeId, amount: 3000, mode: 'NEFT', transactionRef: uniqueTxn() });
    expect(service.findById(feeId).status).toBe('PARTIAL');
    expect(service.findById(feeId).totalPaid).toBe(3000);

    service.recordPayment({ feeRecordId: feeId, amount: 3000, mode: 'DD', transactionRef: uniqueTxn() });
    expect(service.findById(feeId).status).toBe('PARTIAL');
    expect(service.findById(feeId).totalPaid).toBe(6000);

    service.recordPayment({ feeRecordId: feeId, amount: 3000, mode: 'SCHOLARSHIP', transactionRef: uniqueTxn() });
    const final = service.findById(feeId);
    expect(final.status).toBe('PAID');
    expect(final.totalPaid).toBe(9000);
    expect(final.payments).toHaveLength(3);
  });

  it('overpayment beyond totalDue still results in PAID status', () => {
    const feeId = 'int-fee-over';
    injectFeeRecord(service, feeId, 'int-stu-over', 5000);

    const result = service.recordPayment({
      feeRecordId: feeId,
      amount: 6000, // 1000 over
      mode: 'RAZORPAY',
      transactionRef: uniqueTxn(),
    });

    expect(result.status).toBe('PAID');
    expect(result.totalPaid).toBe(6000);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 2 — student isolation
  // ════════════════════════════════════════════════════════════════════════════

  it('payment for student-A does not affect student-B records', () => {
    const feeIdA = 'int-fee-A';
    const feeIdB = 'int-fee-B';
    injectFeeRecord(service, feeIdA, 'int-stu-A', 20000);
    injectFeeRecord(service, feeIdB, 'int-stu-B', 20000);

    // Pay student A's fee fully
    service.recordPayment({
      feeRecordId: feeIdA,
      amount: 20000,
      mode: 'RAZORPAY',
      transactionRef: uniqueTxn('a'),
    });

    // Student A should be PAID
    const recordA = service.findById(feeIdA);
    expect(recordA.status).toBe('PAID');
    expect(recordA.totalPaid).toBe(20000);

    // Student B should still be PENDING with no payments
    const recordB = service.findById(feeIdB);
    expect(recordB.status).toBe('PENDING');
    expect(recordB.totalPaid).toBe(0);
    expect(recordB.payments).toHaveLength(0);

    // findByStudent returns only their own record
    const stuARecords = service.findByStudent('int-stu-A');
    const stuBRecords = service.findByStudent('int-stu-B');

    expect(stuARecords).toHaveLength(1);
    expect(stuARecords[0].id).toBe(feeIdA);
    expect(stuBRecords).toHaveLength(1);
    expect(stuBRecords[0].id).toBe(feeIdB);
    expect(stuBRecords[0].status).toBe('PENDING');
  });

  it('multiple students: each student only sees their own payment history', () => {
    const feeIdC = 'int-fee-C';
    const feeIdD = 'int-fee-D';
    injectFeeRecord(service, feeIdC, 'int-stu-C', 15000);
    injectFeeRecord(service, feeIdD, 'int-stu-D', 15000);

    // C pays 5000, D pays 10000
    service.recordPayment({ feeRecordId: feeIdC, amount: 5000, mode: 'NEFT', transactionRef: uniqueTxn('c') });
    service.recordPayment({ feeRecordId: feeIdD, amount: 10000, mode: 'DD', transactionRef: uniqueTxn('d') });

    const cRecord = service.findById(feeIdC);
    const dRecord = service.findById(feeIdD);

    expect(cRecord.payments).toHaveLength(1);
    expect(cRecord.payments[0].amount).toBe(5000);
    expect(cRecord.totalPaid).toBe(5000);

    expect(dRecord.payments).toHaveLength(1);
    expect(dRecord.payments[0].amount).toBe(10000);
    expect(dRecord.totalPaid).toBe(10000);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 3 — findById after payment reflects updated state
  // ════════════════════════════════════════════════════════════════════════════

  it('findById after payment reflects updated state — multiple reads return consistent data', () => {
    // Use the pre-seeded record
    const beforeAny = service.findById(SEED_FEE_ID);
    expect(beforeAny.totalPaid).toBe(0);
    expect(beforeAny.status).toBe('PENDING');

    // Record a partial payment
    service.recordPayment({
      feeRecordId: SEED_FEE_ID,
      amount: 30000,
      mode: 'RAZORPAY',
      transactionRef: uniqueTxn('fb1'),
    });

    // findById should reflect the update
    const afterFirst = service.findById(SEED_FEE_ID);
    expect(afterFirst.totalPaid).toBe(30000);
    expect(afterFirst.status).toBe('PARTIAL');

    // Second read is consistent (same object reference from in-memory store)
    const secondRead = service.findById(SEED_FEE_ID);
    expect(secondRead.totalPaid).toBe(30000);
    expect(secondRead.status).toBe('PARTIAL');
    expect(secondRead.payments).toHaveLength(1);

    // Complete the payment
    service.recordPayment({
      feeRecordId: SEED_FEE_ID,
      amount: SEED_TOTAL_DUE - 30000,
      mode: 'NEFT',
      transactionRef: uniqueTxn('fb2'),
    });

    const final = service.findById(SEED_FEE_ID);
    expect(final.status).toBe('PAID');
    expect(final.totalPaid).toBe(SEED_TOTAL_DUE);
    expect(final.payments).toHaveLength(2);
  });

  it('findById throws NotFoundException for a non-existent fee record', () => {
    expect(() => service.findById('ghost-fee-id')).toThrow(NotFoundException);
    expect(() => service.findById('ghost-fee-id')).toThrow('Fee record not found');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 4 — payment mode preserved and each payment has unique ID
  // ════════════════════════════════════════════════════════════════════════════

  it('each payment entry has a unique ID and the correct mode is preserved', () => {
    const feeId = 'int-fee-modes';
    injectFeeRecord(service, feeId, 'int-stu-modes', 30000);

    service.recordPayment({ feeRecordId: feeId, amount: 10000, mode: 'RAZORPAY', transactionRef: uniqueTxn() });
    service.recordPayment({ feeRecordId: feeId, amount: 10000, mode: 'NEFT', transactionRef: uniqueTxn() });
    service.recordPayment({ feeRecordId: feeId, amount: 10000, mode: 'DD', transactionRef: uniqueTxn() });

    const record = service.findById(feeId);
    expect(record.payments).toHaveLength(3);
    expect(record.status).toBe('PAID');

    // All payment IDs unique
    const payIds = record.payments.map((p) => p.id);
    expect(new Set(payIds).size).toBe(3);

    // Modes preserved in insertion order
    expect(record.payments[0].mode).toBe('RAZORPAY');
    expect(record.payments[1].mode).toBe('NEFT');
    expect(record.payments[2].mode).toBe('DD');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Test 5 — Razorpay webhook returns acknowledgement without throwing
  // ════════════════════════════════════════════════════════════════════════════

  it('razorpayWebhook returns { acknowledged: true } and does not mutate fee records', () => {
    const before = service.findById(SEED_FEE_ID).totalPaid;

    const result = service.razorpayWebhook({ event: 'payment.captured', payload: {} });
    expect(result).toEqual({ acknowledged: true });

    // No records were mutated
    expect(service.findById(SEED_FEE_ID).totalPaid).toBe(before);
  });
});
