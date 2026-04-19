import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FeeRecord, Payment } from '../entities/fee.entity';
import type { RecordPaymentDto } from '../dto/fees.dto';

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  private readonly records: FeeRecord[] = [
    {
      id: 'fee-1',
      studentId: 's-1',
      institutionId: 'rvce',
      academicYear: '2025-26',
      semester: 5,
      totalDue: 85000,
      totalPaid: 0,
      status: 'PENDING',
      payments: [],
      createdAt: new Date().toISOString(),
    },
  ];

  findByStudent(studentId: string): FeeRecord[] {
    return this.records.filter((r) => r.studentId === studentId);
  }

  findById(id: string): FeeRecord {
    const record = this.records.find((r) => r.id === id);
    if (!record) throw new NotFoundException('Fee record not found');
    return record;
  }

  recordPayment(dto: RecordPaymentDto): FeeRecord {
    const record = this.findById(dto.feeRecordId);

    const payment: Payment = {
      id: randomUUID(),
      feeRecordId: dto.feeRecordId,
      amount: dto.amount,
      mode: dto.mode as Payment['mode'],
      transactionRef: dto.transactionRef,
      paidAt: new Date().toISOString(),
    };

    record.payments.push(payment);
    record.totalPaid += dto.amount;
    record.status = record.totalPaid >= record.totalDue ? 'PAID' : 'PARTIAL';

    this.logger.log(`PaymentReceived: feeRecordId=${dto.feeRecordId} amount=${dto.amount} mode=${dto.mode}`);
    // Production: emit PaymentReceived Kafka event here

    return record;
  }

  razorpayWebhook(payload: Record<string, unknown>): { acknowledged: boolean } {
    this.logger.log('Razorpay webhook received', payload);
    // Production: verify RAZORPAY_WEBHOOK_SECRET HMAC, then call recordPayment
    return { acknowledged: true };
  }
}
