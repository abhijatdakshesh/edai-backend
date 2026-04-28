import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { FeeRemindersService } from './fee-reminders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';

const VALID_RISK_LEVELS = new Set(['HIGH', 'MEDIUM', 'LOW']);
const DEPT_PATTERN = /^[A-Z]{1,10}$/; // e.g. CSE, ECE, ME

@Controller('fee-reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'PRINCIPAL', 'HOD')
export class FeeRemindersController {
  constructor(private readonly svc: FeeRemindersService) {}

  @Get('summary')
  getSummary() {
    return this.svc.getDashboardSummary();
  }

  @Get('outstanding')
  getOutstanding(
    @Query('riskLevel')   riskLevel?: string,
    @Query('department')  department?: string,
    @Query('overdueOnly') overdueOnly?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100,
  ) {
    if (riskLevel && !VALID_RISK_LEVELS.has(riskLevel.toUpperCase())) {
      throw new BadRequestException('riskLevel must be HIGH, MEDIUM, or LOW');
    }
    if (department && !DEPT_PATTERN.test(department.toUpperCase())) {
      throw new BadRequestException('department must be 1–10 uppercase letters');
    }
    const clampedLimit = Math.min(Math.max(1, limit), 500);
    return this.svc.getOutstandingFees({
      riskLevel: riskLevel?.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
      department: department?.toUpperCase(),
      overdueOnly: overdueOnly === 'true',
      limit: clampedLimit,
    });
  }

  @Get(':feePaymentId/history')
  getReminderHistory(@Param('feePaymentId') id: string) {
    return this.svc.getReminderHistory(id);
  }

  @Post(':feePaymentId/call-now')
  triggerCall(@Param('feePaymentId') id: string) {
    return this.svc.triggerManualCall(id);
  }
}
