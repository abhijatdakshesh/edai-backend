import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FeesApiService } from './fees-api.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';

// Payment initiation and verification are intentionally ABSENT from this controller.
// All payment flows must go through parent-portal.controller.ts which enforces
// parent→child ownership and server-side amount computation.
// Exposing payment endpoints here would bypass both checks.

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class FeesApiController {
  constructor(private readonly svc: FeesApiService) {}

  @Roles('ADMIN', 'FACULTY')
  @Get('fees/student/:usn')
  getStudentFees(@Param('usn') usn: string) {
    return this.svc.getStudentFees(usn);
  }

  @Roles('ADMIN', 'FACULTY')
  @Get('fees/student/:usn/history')
  getFeeHistory(@Param('usn') usn: string) {
    return this.svc.getFeeHistory(usn);
  }

  @Roles('ADMIN', 'FACULTY')
  @Get('fees/student/:usn/summary')
  getFeeSummary(@Param('usn') usn: string) {
    return this.svc.getFeeSummary(usn);
  }
}
