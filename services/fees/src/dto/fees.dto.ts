import { IsIn, IsNumber, IsString, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsString()
  feeRecordId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsIn(['RAZORPAY', 'NEFT', 'DD', 'SCHOLARSHIP', 'EMI'])
  mode!: string;

  @IsString()
  transactionRef!: string;
}
