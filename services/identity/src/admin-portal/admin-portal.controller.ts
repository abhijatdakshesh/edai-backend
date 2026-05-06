import { Controller, Get, Post, Patch, Body, Param, Query, Res, UseGuards, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as XLSX from 'xlsx';
import * as PDFDocument from 'pdfkit';
import { AdminPortalService } from './admin-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'TRUSTEE')
@Controller()
export class AdminPortalController {
  constructor(private readonly svc: AdminPortalService) {}

  @Get('admin/alerts')
  getAlerts() {
    return this.svc.getAlerts();
  }

  @Patch('admin/alerts/:id/resolve')
  resolveAlert(@Param('id') id: string) {
    try {
      return this.svc.resolveAlert(id);
    } catch {
      throw new NotFoundException(`Alert ${id} not found`);
    }
  }

  @Get('analytics/admin/dashboard')
  getDashboard() {
    return this.svc.getDashboard();
  }

  @Get('analytics/admin/reports')
  getReports() {
    return this.svc.getReports();
  }

  @Get('analytics/attendance-trend')
  // TODO: pass institutionId to service once multi-tenant filtering is implemented
  getAttendanceTrend() {
    return this.svc.getAttendanceTrend();
  }

  @Get('analytics/fee-collection')
  // TODO: pass year to service once year-based filtering is implemented
  getFeeCollection() {
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
  async exportAnalytics(
    @Query('type') type = 'analytics',
    @Query('format') format = 'csv',
    @Res() res: Response,
  ) {
    const safeType = type.replace(/[^a-zA-Z0-9 _-]/g, '_');
    const safeFormat = ['csv', 'xlsx', 'pdf'].includes(format.toLowerCase()) ? format.toLowerCase() : 'csv';
    const rows = this.svc.getExportRows(safeType);
    const filename = `${safeType.replace(/ /g, '_')}_export`;

    if (safeFormat === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.end(buffer);
    }

    if (safeFormat === 'pdf') {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      doc.pipe(res);
      doc.fontSize(16).text(`Ed8AI Report: ${safeType}`, { underline: true }).moveDown();
      doc.fontSize(10).fillColor('grey').text(`Generated: ${new Date().toLocaleString('en-IN')}`).fillColor('black').moveDown();
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        doc.fontSize(11).font('Helvetica-Bold').text(headers.join('   |   ')).moveDown(0.5);
        doc.font('Helvetica').fontSize(10);
        for (const row of rows) {
          doc.text(Object.values(row).map(String).join('   |   ')).moveDown(0.2);
        }
      }
      doc.end();
      return;
    }

    // CSV — quote all headers and values to prevent injection
    const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const headers = rows.length > 0
      ? Object.keys(rows[0]).map(csvCell).join(',')
      : '"data"';
    const csvBody = rows.map((r) => Object.values(r).map(csvCell).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.end(`${headers}\n${csvBody}`);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'TRUSTEE')
  @Post('exports/download')
  async downloadExport(
    @Body() body: { type?: string; reportType?: string; format?: string; filters?: Record<string, unknown>; requestedBy?: string },
    @Res() res: Response,
  ) {
    const rawType = body.reportType ?? body.type ?? 'export';
    const safeType = rawType.replace(/[^a-zA-Z0-9_\- ]/g, '_');
    const fmt = (body.format ?? 'CSV').toUpperCase();
    const filename = `${safeType.replace(/ /g, '_')}_export`;
    const rows = this.svc.getExportRows(safeType);
    const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

    if (fmt === 'XLSX') {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ data: 'No records found' }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.end(buffer);
    }

    if (fmt === 'PDF') {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      doc.pipe(res);
      doc.fontSize(16).text(`Ed8AI Report: ${safeType}`, { underline: true }).moveDown();
      doc.fontSize(10).fillColor('grey').text(`Generated: ${new Date().toLocaleString('en-IN')}`).fillColor('black').moveDown();
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]!);
        doc.fontSize(11).font('Helvetica-Bold').text(headers.join('   |   ')).moveDown(0.5);
        doc.font('Helvetica').fontSize(10);
        for (const row of rows) {
          doc.text(Object.values(row).map(String).join('   |   ')).moveDown(0.2);
        }
      } else {
        doc.fontSize(11).text('No records found for the selected filters.');
      }
      doc.end();
      return;
    }

    if (fmt === 'VTU') {
      const vtuLines = rows.map(r => Object.values(r).map(v => String(v ?? '')).join('|'));
      const header = rows.length > 0 ? Object.keys(rows[0]!).join('|') : 'DATA';
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}_vtu.txt"`);
      return res.end([header, ...vtuLines].join('\n'));
    }

    // Default: CSV
    const headers = rows.length > 0
      ? Object.keys(rows[0]!).map(csvCell).join(',')
      : '"data"';
    const csvBody = rows.map(r => Object.values(r).map(csvCell).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.end(`${headers}\n${csvBody}`);
  }

  @Get('analytics/performance')
  getClassPerformance(@Query('classId') classId?: string) {
    return this.svc.getClassPerformance(classId);
  }
}
