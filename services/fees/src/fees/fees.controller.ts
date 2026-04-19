import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FeesService } from './fees.service';
import { RecordPaymentDto } from '../dto/fees.dto';
import type { FeeRecord } from '../entities/fee.entity';

@Controller('fees')
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get('student/:studentId')
  byStudent(@Param('studentId') studentId: string): FeeRecord[] {
    return this.feesService.findByStudent(studentId);
  }

  @Get(':id')
  byId(@Param('id') id: string): FeeRecord {
    return this.feesService.findById(id);
  }

  @Post('payments')
  recordPayment(@Body() dto: RecordPaymentDto): FeeRecord {
    return this.feesService.recordPayment(dto);
  }

  @Post('webhooks/razorpay')
  razorpayWebhook(@Body() payload: Record<string, unknown>): { acknowledged: boolean } {
    return this.feesService.razorpayWebhook(payload);
  }
}
