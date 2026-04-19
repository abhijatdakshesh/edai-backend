import { Body, Controller, Get, Header, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  DataExportsService,
  ExportFormat,
  ExportRequest,
  ReportType,
} from './data-exports.service';

@Controller('exports')
export class DataExportsController {
  constructor(private readonly svc: DataExportsService) {}

  /**
   * POST /api/exports/generate
   * Generate a report. Returns job info + inline content (CSV/VTU).
   *
   * Body: {
   *   reportType: 'STUDENT_MASTER' | 'ATTENDANCE' | 'MARKS' | 'VTU_ELIGIBILITY' | 'FEE_COLLECTION' | 'CLASS_STRENGTH'
   *   format: 'CSV' | 'XLSX' | 'PDF' | 'VTU'
   *   filters?: { departmentCode?, semester?, classId?, academicYear? }
   *   requestedBy: string
   * }
   */
  @Post('generate')
  generate(@Body() body: ExportRequest) {
    return this.svc.generateReport(body);
  }

  /**
   * GET /api/exports/jobs
   * Export job history.
   */
  @Get('jobs')
  getJobs() {
    return this.svc.getJobHistory();
  }

  /**
   * POST /api/exports/download
   * Stream CSV/VTU export directly to the browser.
   * For Excel in production: generate .xlsx with exceljs and stream it.
   */
  @Post('download')
  @Header('Cache-Control', 'no-cache')
  download(@Body() body: ExportRequest, @Res() res: Response) {
    const result = this.svc.generateReport(body);
    const format = body.format;

    const contentType =
      format === 'CSV' || format === 'VTU'
        ? 'text/csv'
        : format === 'PDF'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const ext =
      format === 'VTU' ? 'txt' : format === 'XLSX' ? 'xlsx' : format === 'PDF' ? 'pdf' : 'csv';

    const filename = `${body.reportType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.${ext}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(result.content ?? 'No content generated');
  }
}
