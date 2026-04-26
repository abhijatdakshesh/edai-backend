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
export declare class FeesApiService {
    feeItems: FeeItem[];
    getStudentFees(usn: string): FeeSummary;
    initiatePayment(usn: string, amount: number, feeIds: string[]): {
        paymentUrl: string;
        orderId: string;
    };
    markPaid(feeIds: string[]): void;
    getFeeHistory(usn: string): Array<{
        id: string;
        date: string;
        amount: number;
        status: string;
        description: string;
    }>;
    getFeeSummary(usn: string): {
        totalDue: number;
        totalPaid: number;
        nextDue: string;
        overdueCount: number;
    };
    initiatePaymentGateway(usn: string, amount: number, feeIds: string[]): {
        orderId: string;
        amount: number;
        currency: 'INR';
        key: string;
        prefill: {
            name: string;
            email: string;
        };
    };
    verifyPayment(orderId: string, paymentId: string, signature: string): {
        success: true;
        receiptId: string;
        paidAt: string;
    };
}
