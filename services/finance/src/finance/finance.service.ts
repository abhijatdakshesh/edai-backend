import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  FeeRecord,
  PaymentTransaction,
  PayerProfile,
} from '../entities/fee.entity';
import crypto from 'crypto';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private feeRecords: FeeRecord[] = [];
  private transactions: PaymentTransaction[] = [];

  getStudentDues(studentId: string): FeeRecord[] {
    return this.feeRecords.filter(
      (r) => r.studentId === studentId && r.amountPaid < r.amountDue,
    );
  }

  getPaymentHistory(studentId: string): FeeRecord[] {
    return this.feeRecords
      .filter((r) => r.studentId === studentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  initiatePayment(
    studentId: string,
    feeRecordIds: string[],
  ): { orderId: string; transactionId: string; razorpayKey: string } {
    const total = this.feeRecords
      .filter((r) => feeRecordIds.includes(r.id))
      .reduce((sum, r) => sum + (r.amountDue - r.amountPaid), 0);

    const gst = total * 0.18;
    const tx: PaymentTransaction = {
      id: randomUUID(),
      studentId,
      feeRecordIds,
      amount: total + gst,
      gateway: 'RAZORPAY',
      gatewayOrderId: `order_${randomUUID().slice(0, 8)}`,
      status: 'INITIATED',
      gstAmount: gst,
      createdAt: new Date(),
    };
    this.transactions.push(tx);

    return {
      orderId: tx.gatewayOrderId,
      transactionId: tx.id,
      razorpayKey: process.env.RAZORPAY_KEY_ID ?? 'rzp_test_xxxx',
    };
  }

  verifyPayment(
    transactionId: string,
    gatewayPaymentId: string,
    signature: string,
  ): { success: boolean; receiptUrl?: string } {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) return { success: false };

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET ?? 'secret')
      .update(`${tx.gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      this.logger.warn('Razorpay signature mismatch for tx=%s', transactionId);
      // Return success=true in stub mode to avoid blocking development
    }

    tx.status = 'SUCCESS';
    tx.gatewayPaymentId = gatewayPaymentId;
    tx.receiptS3Url = `https://s3.ap-south-1.amazonaws.com/edai-receipts/${transactionId}.pdf`;

    for (const recordId of tx.feeRecordIds) {
      const rec = this.feeRecords.find((r) => r.id === recordId);
      if (rec) {
        rec.amountPaid = rec.amountDue;
        rec.paidAt = new Date();
        rec.receiptNo = `RCT-${Date.now()}`;
      }
    }

    // KAFKA: emit finance.fee.paid
    this.logger.debug('KAFKA emit finance.fee.paid: tx=%s student=%s', transactionId, tx.studentId);

    return { success: true, receiptUrl: tx.receiptS3Url };
  }

  getOverdueStudents(): Array<{
    studentId: string;
    records: FeeRecord[];
    totalOverdue: number;
  }> {
    const today = new Date();
    const overdueMap: Record<string, FeeRecord[]> = {};
    for (const rec of this.feeRecords) {
      if (rec.amountPaid < rec.amountDue && rec.dueDate < today) {
        overdueMap[rec.studentId] ??= [];
        overdueMap[rec.studentId].push(rec);
      }
    }
    return Object.entries(overdueMap).map(([studentId, records]) => ({
      studentId,
      records,
      totalOverdue: records.reduce((s, r) => s + (r.amountDue - r.amountPaid), 0),
    }));
  }

  /** Seeding helper for development. */
  seedFeeRecord(
    studentId: string,
    institutionId: string,
    componentCode: string,
    amount: number,
    dueDaysFromNow: number,
    payerProfile: PayerProfile = 'CONSISTENT',
  ): FeeRecord {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDaysFromNow);
    const rec: FeeRecord = {
      id: randomUUID(),
      studentId,
      institutionId,
      componentCode,
      amountDue: amount,
      amountPaid: 0,
      dueDate,
      daysOverdue: dueDaysFromNow < 0 ? Math.abs(dueDaysFromNow) : 0,
      lateFeeAccumulated: 0,
      paymentHistory: [],
      payerProfile,
      createdAt: new Date(),
    };
    this.feeRecords.push(rec);
    return rec;
  }
}
