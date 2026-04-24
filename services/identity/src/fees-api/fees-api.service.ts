import { Injectable, NotFoundException } from '@nestjs/common';

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
export class FeesApiService {
  feeItems: FeeItem[] = [];

  getStudentFees(usn: string): FeeSummary {
    const items = this.feeItems.filter((f) => f.usn === usn);
    if (items.length === 0) throw new NotFoundException('Fee records not found');
    const totalDue = items.reduce((sum, f) => sum + f.amount, 0);
    const totalPaid = items.filter((f) => f.status === 'PAID').reduce((sum, f) => sum + f.amount, 0);
    const totalOutstanding = items.filter((f) => f.status !== 'PAID').reduce((sum, f) => sum + f.amount, 0);
    const hasOverdue = items.some((f) => f.status === 'OVERDUE');
    const status: FeeSummary['status'] = totalOutstanding === 0 ? 'PAID' : hasOverdue ? 'OVERDUE' : 'PENDING';
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

  markPaid(feeIds: string[]): void {
    for (const id of feeIds) {
      const fee = this.feeItems.find((f) => f.id === id);
      if (fee) {
        fee.status = 'PAID';
        fee.paidDate = new Date().toISOString();
      }
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
    return { totalDue: totalDue || 45000, totalPaid, nextDue, overdueCount };
  }

  initiatePaymentGateway(
    usn: string,
    amount: number,
    feeIds: string[],
  ): { orderId: string; amount: number; currency: 'INR'; key: string; prefill: { name: string; email: string } } {
    const orderId = `order_${Date.now()}`;
    return {
      orderId,
      amount,
      currency: 'INR',
      key: 'rzp_test_stub_key',
      prefill: { name: `Student ${usn}`, email: `${usn.toLowerCase()}@rvce.edu.in` },
    };
  }

  verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string,
  ): { success: true; receiptId: string; paidAt: string } {
    return {
      success: true,
      receiptId: `rcpt_${Date.now()}`,
      paidAt: new Date().toISOString(),
    };
  }
}
