import { Controller, Get, Post, Body, Query, Res, UseGuards } from '@nestjs/common';
import { AdminPortalService } from './admin-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'TRUSTEE')
@Controller()
export class AdminPortalController {
  constructor(private readonly svc: AdminPortalService) {}

  @Get('analytics/admin/dashboard')
  getDashboard() {
    return this.svc.getDashboard();
  }

  @Get('analytics/admin/reports')
  getReports() {
    return this.svc.getReports();
  }

  @Get('analytics/attendance-trend')
  getAttendanceTrend(@Query('institutionId') _institutionId?: string) {
    return this.svc.getAttendanceTrend();
  }

  @Get('analytics/fee-collection')
  getFeeCollection(@Query('year') _year?: string) {
    return this.svc.getFeeCollection();
  }

  @Get('analytics/attendance/by-department')
  getDeptAttendance() {
    return this.svc.getDeptAttendance();
  }

  @Get('admin/naac')
  getNaac() {
    return this.svc.getNaac();
  }

  @Get('admin/naac/metrics')
  getNaacMetrics() {
    return this.svc.getNaacMetrics();
  }

  @Get('admin/placements/summary')
  getPlacementSummary() {
    return this.svc.getPlacementSummary();
  }

  @Get('admin/placements/predictions')
  getPlacementPredictions(
    @Query('dept') dept?: string,
    @Query('likelihood') likelihood?: string,
  ) {
    return this.svc.getPlacementPredictions(dept, likelihood);
  }

  @Post('admin/bulk-import/trigger')
  triggerBulkImport(
    @Body()
    body: {
      entityType: 'students' | 'faculty' | 'classes' | 'courses';
      fileUrl: string;
    },
  ) {
    return this.svc.triggerBulkImport(body.entityType, body.fileUrl);
  }

  @Get('analytics/export')
  exportAnalytics(@Query('type') type?: string) {
    return this.svc.exportAnalytics(type);
  }

  @Post('exports/download')
  downloadExport(
    @Body() body: { type: string; format: string; filters?: Record<string, unknown>; requestedBy?: string },
    @Res({ passthrough: true }) res: import('express').Response,
  ) {
    // Sanitize: strip any characters that could inject CSV formulas or split HTTP headers
    const safeType = (body.type ?? 'export').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeExt = (body.format ?? 'CSV').toLowerCase().replace(/[^a-z]/g, '') || 'csv';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="export_${safeType}.${safeExt}"`);
    return `"type","format"\n"${safeType}","${safeExt}"`;
  }

  @Get('analytics/performance')
  getClassPerformance(@Query('classId') classId?: string) {
    return this.svc.getClassPerformance(classId);
  }
}
