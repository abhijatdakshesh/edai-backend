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
}
