import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AdminPortalService } from './admin-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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

  @Get('admin/naac')
  getNaac() {
    return this.svc.getNaac();
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
}
