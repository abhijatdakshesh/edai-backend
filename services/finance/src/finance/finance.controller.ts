import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FinanceService } from './finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly svc: FinanceService) {}

  @Get('students/:id/dues')
  getDues(@Param('id') studentId: string) {
    return this.svc.getStudentDues(studentId);
  }

  @Get('students/:id/history')
  getHistory(@Param('id') studentId: string) {
    return this.svc.getPaymentHistory(studentId);
  }

  @Post('payment/initiate')
  initiatePayment(@Body() dto: { studentId: string; feeRecordIds: string[] }) {
    return this.svc.initiatePayment(dto.studentId, dto.feeRecordIds);
  }

  @Post('payment/verify')
  verifyPayment(
    @Body()
    dto: {
      transactionId: string;
      gatewayPaymentId: string;
      signature: string;
    },
  ) {
    return this.svc.verifyPayment(dto.transactionId, dto.gatewayPaymentId, dto.signature);
  }

  @Get('overdue')
  getOverdue() {
    return this.svc.getOverdueStudents();
  }
}
