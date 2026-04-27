import {
  Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { JobsService, PlacementDrive } from './jobs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class JobsController {
  constructor(private readonly svc: JobsService) {}

  // ─── Job board ───────────────────────────────────────────────────────────

  @Get('jobs')
  getJobs() {
    return this.svc.getJobs();
  }

  @Get('jobs/applications/me')
  getMyApplications(@Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getMyApplications(usn);
  }

  @Patch('jobs/applications/:applicationId/withdraw')
  withdrawApplication(@Param('applicationId') id: string) {
    return this.svc.withdraw(id);
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string) {
    return this.svc.getJob(id);
  }

  @Post('jobs/:id/apply')
  apply(@Param('id') id: string, @Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.apply(id, usn);
  }

  // ─── Placement Intelligence SKU ─────────────────────────────────────────

  @Get('placements/predictions')
  getPredictions(
    @Query('dept') dept: string,
    @Query('likelihood') likelihood: string,
  ) {
    return this.svc.getPredictions(dept, likelihood);
  }

  @Get('placements/summary')
  getPlacementSummary() {
    return this.svc.getPlacementSummary();
  }

  @Get('placements/stats')
  getPlacementStats(
    @Query('dept') dept?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.svc.getPlacementStats(dept, academicYear);
  }

  @Get('placements/skill-gaps')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'TRUSTEE')
  getSkillGapReport(@Query('dept') dept?: string) {
    return this.svc.getSkillGapReport(dept);
  }

  // ─── Drives (CRM) ────────────────────────────────────────────────────────

  @Get('placements/drives')
  getDrives(@Query('status') status?: string) {
    return this.svc.getDrives(status);
  }

  @Get('placements/drives/:id')
  getDrive(@Param('id') id: string) {
    return this.svc.getDrive(id);
  }

  @Post('placements/drives')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN')
  createDrive(@Body() body: Omit<PlacementDrive, 'id' | 'offersExtended'>) {
    return this.svc.createDrive(body);
  }

  @Patch('placements/drives/:id/complete')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN')
  completeDrive(
    @Param('id') id: string,
    @Body() body: { offersExtended: number },
  ) {
    return this.svc.completeDrive(id, body.offersExtended);
  }

  // ─── Alumni ──────────────────────────────────────────────────────────────

  @Get('placements/alumni')
  getAlumni(
    @Query('dept') dept?: string,
    @Query('graduationYear') graduationYear?: string,
  ) {
    return this.svc.getAlumniOutcomes(dept, graduationYear ? +graduationYear : undefined);
  }

  @Post('placements/alumni')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL')
  addAlumni(@Body() body: any) {
    return this.svc.addAlumniOutcome(body);
  }
}
