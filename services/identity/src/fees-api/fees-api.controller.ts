import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { FeesApiService } from './fees-api.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class FeesApiController {
  constructor(private readonly svc: FeesApiService) {}

  @Get('fees/student/:usn')
  getStudentFees(@Param('usn') usn: string) {
    return this.svc.getStudentFees(usn);
  }

  @Post('fees/pay')
  initiatePayment(
    @Body() body: { usn: string; amount: number; feeIds: string[] },
  ) {
    return this.svc.initiatePayment(body.usn, body.amount, body.feeIds);
  }

  @Get('fees/student/:usn/history')
  getFeeHistory(@Param('usn') usn: string) {
    return this.svc.getFeeHistory(usn);
  }

  @Get('fees/student/:usn/summary')
  getFeeSummary(@Param('usn') usn: string) {
    return this.svc.getFeeSummary(usn);
  }

  @Post('fees/payment/initiate')
  initiatePaymentGateway(
    @Body() body: { usn: string; amount: number; feeIds: string[] },
  ) {
    return this.svc.initiatePaymentGateway(body.usn, body.amount, body.feeIds);
  }

  @Post('fees/payment/verify')
  async verifyPayment(
    @Body() body: { orderId: string; paymentId: string; signature: string },
  ) {
    return this.svc.verifyPayment(body.orderId, body.paymentId, body.signature);
  }
}
