import { FeesApiService } from './fees-api.service';
export declare class FeesApiController {
    private readonly svc;
    constructor(svc: FeesApiService);
    getStudentFees(usn: string): import("./fees-api.service").FeeSummary;
    initiatePayment(body: {
        usn: string;
        amount: number;
        feeIds: string[];
    }): {
        paymentUrl: string;
        orderId: string;
    };
    getFeeHistory(usn: string): {
        id: string;
        date: string;
        amount: number;
        status: string;
        description: string;
    }[];
    getFeeSummary(usn: string): {
        totalDue: number;
        totalPaid: number;
        nextDue: string;
        overdueCount: number;
    };
    initiatePaymentGateway(body: {
        usn: string;
        amount: number;
        feeIds: string[];
    }): {
        orderId: string;
        amount: number;
        currency: "INR";
        key: string;
        prefill: {
            name: string;
            email: string;
        };
    };
    verifyPayment(body: {
        orderId: string;
        paymentId: string;
        signature: string;
    }): {
        success: true;
        receiptId: string;
        paidAt: string;
    };
}
