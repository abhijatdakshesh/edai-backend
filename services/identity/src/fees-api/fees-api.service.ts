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
  totalOutstanding: number;
  items: FeeItem[];
}

@Injectable()
export class FeesApiService {
  feeItems: FeeItem[] = [];

  getStudentFees(usn: string): FeeSummary {
    const items = this.feeItems.filter((f) => f.usn === usn);
    if (items.length === 0) throw new NotFoundException('Fee records not found');
    const totalDue = items.reduce((sum, f) => sum + f.amount, 0);
    const totalOutstanding = items
      .filter((f) => f.status !== 'PAID')
      .reduce((sum, f) => sum + f.amount, 0);
    return { totalDue, totalOutstanding, items };
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
}
