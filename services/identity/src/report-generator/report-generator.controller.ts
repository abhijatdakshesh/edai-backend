import { Controller, Post, Get, Body, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { ReportGeneratorService, ReportParams } from './report-generator.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'PRINCIPAL')
@Controller('reports')
export class ReportGeneratorController {
  private readonly logger = new Logger(ReportGeneratorController.name);

  constructor(private readonly svc: ReportGeneratorService) {}

  @Post('generate')
  async generate(
    @Req() req: { user: { id: string; role?: string } },
    @Body() body: { reportType: string; params: ReportParams },
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    try {
      const zipBuf = await this.svc.generate(body.reportType, body.params ?? {}, req.user.id);
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${body.reportType}-report.zip"`,
        'Content-Length': String(zipBuf.byteLength),
      });
      res.send(zipBuf);
    } catch (err) {
      this.logger.error('Report generation failed', err);
      if (!res.headersSent) {
        res.status(500).json({ error: (err as Error).message ?? 'Report generation failed' });
      }
    }
  }

  @Get('history')
  getMyHistory(@Req() req: { user: { id: string } }) {
    return this.svc.getHistory(req.user.id);
  }

  @Get('history/all')
  getAllHistory() {
    return this.svc.getAllHistory();
  }
}
