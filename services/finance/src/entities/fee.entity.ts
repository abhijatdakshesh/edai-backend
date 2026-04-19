export type PayerProfile = 'CONSISTENT' | 'FIRST_LATE' | 'HARDSHIP' | 'SIBLING';
export type PaymentGateway = 'RAZORPAY' | 'PAYU';
export type PaymentStatus = 'INITIATED' | 'SUCCESS' | 'FAILED';
export type ScholarshipStatus = 'ELIGIBLE' | 'APPLIED' | 'AWARDED' | 'REJECTED';

export interface FeeComponent {
  code: string;
  name: string;
  amount: number;
  dueDate: string; // ISO date
  lateFeePerDay: number;
  gracePeriodDays: number;
}

export interface FeeStructure {
  id: string;
  institutionId: string;
  classId: string;
  academicYear: string;
  components: FeeComponent[];
}

export interface PartialPayment {
  amount: number;
  paidAt: Date;
  transactionId: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  institutionId: string;
  componentCode: string;
  amountDue: number;
  amountPaid: number;
  dueDate: Date;
  paidAt?: Date;
  receiptNo?: string;
  daysOverdue: number;
  lateFeeAccumulated: number;
  paymentHistory: PartialPayment[];
  payerProfile: PayerProfile;
  createdAt: Date;
}

export interface PaymentTransaction {
  id: string;
  studentId: string;
  feeRecordIds: string[];
  amount: number;
  gateway: PaymentGateway;
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  status: PaymentStatus;
  receiptS3Url?: string;
  gstAmount: number;
  createdAt: Date;
}

export interface EligibilityCriteria {
  minGpa?: number;
  maxIncome?: number;
  attendanceMin?: number;
  category?: string;
}

export interface Scholarship {
  id: string;
  institutionId: string;
  name: string;
  eligibilityCriteria: EligibilityCriteria;
  amount: number;
  renewableAnnually: boolean;
  deadline: Date;
  isActive: boolean;
}

export interface StudentScholarship {
  id: string;
  studentId: string;
  scholarshipId: string;
  status: ScholarshipStatus;
  detectedAt: Date;
  appliedAt?: Date;
  awardedAt?: Date;
  awardedAmount?: number;
}
