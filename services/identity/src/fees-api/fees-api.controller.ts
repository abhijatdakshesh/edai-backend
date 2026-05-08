import { Controller, ForbiddenException, Get, Param, Request, UseGuards } from '@nestjs/common';
import { FeesApiService } from './fees-api.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';

// Payment initiation and verification are intentionally ABSENT from this controller.
// All payment flows must go through parent-portal.controller.ts which enforces
// parent→child ownership and server-side amount computation.
// Exposing payment endpoints here would bypass both checks.

function assertOwnerOrStaff(req: any, usn: string): void {
  const role = req.user?.role;
  if (role === 'ADMIN' || role === 'FACULTY' || role === 'PRINCIPAL' || role === 'HOD') return;
  if (role === 'STUDENT') {
    const own = req.user?.sapId ?? req.user?.sub;
    if (own && own === usn) return;
  }
  throw new ForbiddenException('Cannot view another student fees');
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class FeesApiController {
  constructor(private readonly svc: FeesApiService) {}

  @Roles('ADMIN', 'FACULTY', 'PRINCIPAL', 'HOD', 'STUDENT')
  @Get('fees/student/:usn')
  getStudentFees(@Param('usn') usn: string, @Request() req: any) {
    assertOwnerOrStaff(req, usn);
    return this.svc.getStudentFees(usn);
  }

  @Roles('ADMIN', 'FACULTY', 'PRINCIPAL', 'HOD', 'STUDENT')
  @Get('fees/student/:usn/history')
  getFeeHistory(@Param('usn') usn: string, @Request() req: any) {
    assertOwnerOrStaff(req, usn);
    return this.svc.getFeeHistory(usn);
  }

  @Roles('ADMIN', 'FACULTY', 'PRINCIPAL', 'HOD', 'STUDENT')
  @Get('fees/student/:usn/summary')
  getFeeSummary(@Param('usn') usn: string, @Request() req: any) {
    assertOwnerOrStaff(req, usn);
    return this.svc.getFeeSummary(usn);
  }
}
