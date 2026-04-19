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
export declare class FeesApiService {
    feeItems: FeeItem[];
    getStudentFees(usn: string): FeeSummary;
    initiatePayment(usn: string, amount: number, feeIds: string[]): {
        paymentUrl: string;
        orderId: string;
    };
    markPaid(feeIds: string[]): void;
}
