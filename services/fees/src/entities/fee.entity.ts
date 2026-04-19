export type FeeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';
export type PaymentMode = 'RAZORPAY' | 'NEFT' | 'DD' | 'SCHOLARSHIP' | 'EMI';

export interface FeeStructure {
  id: string;
  institutionId: string;
  academicYear: string;
  semester: number;
  heads: FeeHead[];
  totalAmount: number;
}

export interface FeeHead {
  name: string;
  amount: number;
  mandatory: boolean;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  institutionId: string;
  academicYear: string;
  semester: number;
  totalDue: number;
  totalPaid: number;
  status: FeeStatus;
  payments: Payment[];
  createdAt: string;
}

export interface Payment {
  id: string;
  feeRecordId: string;
  amount: number;
  mode: PaymentMode;
  transactionRef: string;
  paidAt: string;
}
