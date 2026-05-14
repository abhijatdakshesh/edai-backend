import { Controller, Get, Post, Param, Body, Request, UseGuards, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ParentPortalService } from './parent-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class ParentPortalController {
  constructor(private readonly svc: ParentPortalService) {}

  private parentId(req: any): string {
    const id = req.user?.sub ?? req.user?.id;
    if (!id) throw new UnauthorizedException('Cannot identify parent from token');
    return id;
  }

  private assertOwnership(req: any, usn: string): void {
    const role: string = req.user?.role ?? '';
    if (['ADMIN', 'PRINCIPAL', 'STAFF'].includes(role.toUpperCase())) return;
    const parentId = this.parentId(req);
    if (!this.svc.isParentOf(parentId, usn)) {
      throw new ForbiddenException('Access denied: student not linked to this account');
    }
  }

  @Get('parent/dashboard')
  getDashboard(@Request() req: any) {
    return this.svc.getDashboard(this.parentId(req));
  }

  @Get('parent/children')
  getChildren(@Request() req: any) {
    return this.svc.getChildren(this.parentId(req));
  }

  @Get('parent/children/:usn/attendance')
  getChildAttendance(@Param('usn') usn: string, @Request() req: any) {
    this.assertOwnership(req, usn);
    return this.svc.getChildAttendance(usn);
  }

  @Get('parent/children/:usn/results')
  getChildResults(@Param('usn') usn: string, @Request() req: any) {
    this.assertOwnership(req, usn);
    return this.svc.getChildResults(usn);
  }

  @Get('parent/children/:usn/fees')
  getChildFees(@Param('usn') usn: string, @Request() req: any) {
    this.assertOwnership(req, usn);
    return this.svc.getChildFees(usn);
  }

  @Get('parent/children/:usn')
  getChild(@Param('usn') usn: string, @Request() req: any) {
    this.assertOwnership(req, usn);
    return this.svc.getChild(usn);
  }

  @Post('parent/children/:usn/fees/pay')
  async payFees(
    @Param('usn') usn: string,
    @Body() body: { feeIds: string[] },  // amount intentionally excluded — server computes it
    @Request() req: any,
  ) {
    this.assertOwnership(req, usn);
    return this.svc.payFees(usn, body.feeIds);
  }

  @Post('parent/children/:usn/fees/verify')
  async verifyFeePayment(
    @Param('usn') usn: string,
    @Body() body: { orderId: string; paymentId: string; signature: string },
    @Request() req: any,
  ) {
    this.assertOwnership(req, usn);
    return this.svc.verifyFeePayment(body.orderId, body.paymentId, body.signature);
  }

  @Get('parent/children/:usn/scholarship-eligibility')
  checkScholarship(@Param('usn') usn: string, @Request() req: any) {
    this.assertOwnership(req, usn);
    return this.svc.checkScholarship(usn);
  }
}
