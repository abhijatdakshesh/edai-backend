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
}
