import { Controller, Get, Post, Body, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'TRUSTEE')
  @Post('exports/download')
  downloadExport(
    @Body() body: { type: string; format: string; filters?: Record<string, unknown>; requestedBy?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const ALLOWED_EXTS: Record<string, string> = { CSV: 'csv', XLSX: 'xlsx', PDF: 'pdf', VTU: 'txt' };
    const CONTENT_TYPES: Record<string, string> = {
      csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf', txt: 'text/plain',
    };
    const safeType = (body.type ?? 'export').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeExt = ALLOWED_EXTS[(body.format ?? '').toUpperCase()] ?? 'csv';
    const data = this.svc.exportAnalytics(safeType);
    res.setHeader('Content-Type', CONTENT_TYPES[safeExt] ?? 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="export_${safeType}.${safeExt}"`);
    return JSON.stringify(data);
  }

  @Get('analytics/performance')
  getClassPerformance(@Query('classId') classId?: string) {
    return this.svc.getClassPerformance(classId);
  }
}
