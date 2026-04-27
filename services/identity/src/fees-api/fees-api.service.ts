import { Injectable, NotFoundException, BadRequestException, Optional, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { FeeItemEntity } from '../entities/fee-item.entity';

export interface FeeItem {
  id: string;
  usn: string;
  component: string;
  semester: number;
  amount: number;
  dueDate: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  paidDate?: string;
}

export interface FeeSummary {
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  items: FeeItem[];
}

@Injectable()
export class FeesApiService implements OnModuleInit {
  /** In-memory fallback — used when DATABASE_URL is not configured */
  feeItems: FeeItem[] = [];

  constructor(
    @Optional() @InjectRepository(FeeItemEntity)
    private readonly feeRepo?: Repository<FeeItemEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.feeRepo) return;
    const rows = await this.feeRepo.find();
    this.feeItems = rows.map((r) => ({
      id: r.id,
      usn: r.usn,
      component: r.component,
      semester: r.semester,
      amount: Number(r.amount),
      dueDate: r.dueDate,
      status: r.status as FeeItem['status'],
      paidDate: r.paidDate ?? undefined,
    }));
  }

  getStudentFees(usn: string): FeeSummary {
    const items = this.feeItems.filter((f) => f.usn === usn);
    if (items.length === 0) throw new NotFoundException('Fee records not found');
    const totalDue = items.reduce((sum, f) => sum + f.amount, 0);
    const totalPaid = items.filter((f) => f.status === 'PAID').reduce((sum, f) => sum + f.amount, 0);
    const totalOutstanding = items.filter((f) => f.status !== 'PAID').reduce((sum, f) => sum + f.amount, 0);
    const hasOverdue = items.some((f) => f.status === 'OVERDUE');
    const status: FeeSummary['status'] = hasOverdue ? 'OVERDUE' : totalOutstanding === 0 ? 'PAID' : 'PENDING';
    return { totalDue, totalPaid, totalOutstanding, status, items };
  }

  initiatePayment(
    usn: string,
    amount: number,
    feeIds: string[],
  ): { paymentUrl: string; orderId: string } {
    const orderId = `order_${Date.now()}`;
    return {
      paymentUrl: `https://razorpay.com/pay/stub_${orderId}`,
      orderId,
    };
  }

  async markPaid(feeIds: string[]): Promise<void> {
    const paidDate = new Date().toISOString();
    for (const id of feeIds) {
      const fee = this.feeItems.find((f) => f.id === id);
      if (fee) {
        fee.status = 'PAID';
        fee.paidDate = paidDate;
      }
    }
    if (this.feeRepo) {
      await this.feeRepo.manager.transaction(async (manager) => {
        for (const id of feeIds) {
          await manager.update(FeeItemEntity, { id }, { status: 'PAID', paidDate });
        }
      });
    }
  }

  getFeeHistory(
    usn: string,
  ): Array<{ id: string; date: string; amount: number; status: string; description: string }> {
    const items = this.feeItems.filter((f) => f.usn === usn);
    if (items.length > 0) {
      return items.map((f) => ({
        id: f.id,
        date: f.paidDate ?? f.dueDate,
        amount: f.amount,
        status: f.status,
        description: `${f.component} - Semester ${f.semester}`,
      }));
    }
    // Return stub history for the last 12 months
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i * 2);
      return {
        id: `fee-hist-${usn}-${i}`,
        date: d.toISOString(),
        amount: 45000,
        status: i === 0 ? 'PENDING' : 'PAID',
        description: `Tuition Fee - Semester ${6 - i}`,
      };
    });
  }

  getFeeSummary(
    usn: string,
  ): { totalDue: number; totalPaid: number; nextDue: string; overdueCount: number } {
    const items = this.feeItems.filter((f) => f.usn === usn);
    const totalDue = items.filter((f) => f.status !== 'PAID').reduce((s, f) => s + f.amount, 0);
    const totalPaid = items.filter((f) => f.status === 'PAID').reduce((s, f) => s + f.amount, 0);
    const overdueCount = items.filter((f) => f.status === 'OVERDUE').length;
    const nextDueItem = items.find((f) => f.status === 'PENDING');
    const nextDue = nextDueItem?.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return { totalDue, totalPaid, nextDue, overdueCount };
  }

  /** Maps orderId → feeIds so verifyPayment can gate markPaid to the right IDs */
  private readonly pendingOrders = new Map<string, { usn: string; feeIds: string[] }>();

  initiatePaymentGateway(
    usn: string,
    amount: number,
    feeIds: string[],
  ): { orderId: string; amount: number; currency: 'INR'; key: string; prefill: { name: string; email: string } } {
    const keyId = process.env['RAZORPAY_KEY_ID'] ?? 'rzp_test_stub_key';
    const orderId = `order_${Date.now()}`;
    this.pendingOrders.set(orderId, { usn, feeIds });
    return {
      orderId,
      amount,
      currency: 'INR',
      key: keyId,
      prefill: { name: `Student ${usn}`, email: `${usn.toLowerCase()}@rvce.edu.in` },
    };
  }

  async verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string,
  ): Promise<{ success: boolean; receiptId?: string; paidAt?: string; error?: string }> {
    if (!signature) throw new BadRequestException('razorpay_signature is required');

    const secret = process.env['RAZORPAY_KEY_SECRET'];
    if (!secret) {
      // Dev mode — no secret configured, skip HMAC and return success for testing
      if (process.env.NODE_ENV === 'production') {
        throw new Error('RAZORPAY_KEY_SECRET env var is required in production');
      }
      const pending = this.pendingOrders.get(orderId);
      if (pending) {
        await this.markPaid(pending.feeIds);
        this.pendingOrders.delete(orderId);
      }
      return { success: true, receiptId: `rcpt_${Date.now()}`, paidAt: new Date().toISOString() };
    }

    // Production path — HMAC-SHA256 verification with timing-safe comparison
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(signature, 'hex');

    if (
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      return { success: false, error: 'invalid_signature' };
    }

    // Signature valid — mark only the fees that belong to this order
    const pending = this.pendingOrders.get(orderId);
    if (pending) {
      this.markPaid(pending.feeIds);
      this.pendingOrders.delete(orderId);
    }

    return { success: true, receiptId: `rcpt_${Date.now()}`, paidAt: new Date().toISOString() };
  }
}
