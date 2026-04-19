"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeesApiService = void 0;
const common_1 = require("@nestjs/common");
let FeesApiService = class FeesApiService {
    constructor() {
        this.feeItems = [];
    }
    getStudentFees(usn) {
        const items = this.feeItems.filter((f) => f.usn === usn);
        if (items.length === 0)
            throw new common_1.NotFoundException('Fee records not found');
        const totalDue = items.reduce((sum, f) => sum + f.amount, 0);
        const totalOutstanding = items
            .filter((f) => f.status !== 'PAID')
            .reduce((sum, f) => sum + f.amount, 0);
        return { totalDue, totalOutstanding, items };
    }
    initiatePayment(usn, amount, feeIds) {
        const orderId = `order_${Date.now()}`;
        return {
            paymentUrl: `https://razorpay.com/pay/stub_${orderId}`,
            orderId,
        };
    }
    markPaid(feeIds) {
        for (const id of feeIds) {
            const fee = this.feeItems.find((f) => f.id === id);
            if (fee) {
                fee.status = 'PAID';
                fee.paidDate = new Date().toISOString();
            }
        }
    }
};
exports.FeesApiService = FeesApiService;
exports.FeesApiService = FeesApiService = __decorate([
    (0, common_1.Injectable)()
], FeesApiService);
//# sourceMappingURL=fees-api.service.js.map