import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { AbcCreditsService } from './abc-credits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class AbcCreditsController {
  constructor(private readonly svc: AbcCreditsService) {}

  /** Student: view own ABC credit ledger */
  @Get('abc-credits/ledger')
  getMyLedger(@Request() req: any) {
    const usn: string = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'] ?? 'default';
    return this.svc.getLedger(usn, institutionId);
  }

  /** Admin/HOD: view any student's ledger */
  @Get('abc-credits/ledger/:usn')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'FACULTY')
  getLedger(@Param('usn') usn: string, @Request() req: any) {
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'] ?? 'default';
    return this.svc.getLedger(usn, institutionId);
  }

  /** Student: add self-declared ABC credits (e.g., NPTEL certificate) */
  @Post('abc-credits')
  addCredits(@Body() body: any, @Request() req: any) {
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'] ?? 'default';
    return this.svc.addCredits({ ...body, institutionId });
  }

  /** Admin: verify and link ABC DigiLocker ID */
  @Patch('abc-credits/:id/verify')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL')
  verifyCredit(@Param('id') id: string, @Body() body: { abcId: string }) {
    return this.svc.verifyCredit(id, body.abcId);
  }

  /** Admin: bulk transfer credits from another institution */
  @Post('abc-credits/transfer')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL')
  transferCredits(@Body() body: { usn: string; fromInstitution: string; courses: any[] }, @Request() req: any) {
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'] ?? 'default';
    return this.svc.transferCredits(body.usn, body.fromInstitution, body.courses, institutionId);
  }

  /** Student: view own multidisciplinary electives */
  @Get('abc-credits/electives')
  getMyElectives(@Request() req: any) {
    const usn: string = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getElectives(usn);
  }

  /** Faculty/Admin: add elective enrollment */
  @Post('abc-credits/electives')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'HOD', 'FACULTY')
  addElective(@Body() body: any) {
    return this.svc.addElective(body);
  }

  /** Student: check NEP 2020 compliance */
  @Get('abc-credits/nep-compliance')
  checkNepCompliance(@Query('coreCredits') coreCredits: string, @Request() req: any) {
    const usn: string = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'] ?? 'default';
    return this.svc.checkNepCompliance(usn, Number(coreCredits ?? 0), institutionId);
  }

  /** Admin/HOD: institution-level ABC credits summary */
  @Get('abc-credits/institution-summary')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'TRUSTEE')
  getInstitutionSummary(@Request() req: any) {
    const institutionId: string = req.user?.institutionId ?? process.env['INSTITUTION_ID'] ?? 'default';
    return this.svc.getInstitutionSummary(institutionId);
  }
}
