import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('dashboard')
  dashboard(@Query('institutionId') institutionId = 'default') {
    return this.svc.getDashboard(institutionId);
  }

  @Get('students/at-risk')
  atRisk(@Query('institutionId') institutionId = 'default') {
    return this.svc.getAtRiskStudents(institutionId);
  }

  @Get('teachers/workload')
  teacherWorkload(@Query('institutionId') institutionId = 'default') {
    return this.svc.getTeacherWorkload(institutionId);
  }

  @Get('subjects/intelligence')
  subjectIntelligence(@Query('institutionId') institutionId = 'default') {
    return this.svc.getSubjectIntelligence(institutionId);
  }

  @Get('audit/anomalies')
  auditAnomalies(@Query('institutionId') institutionId = 'default') {
    return this.svc.getAuditAnomalies(institutionId);
  }

  @Get('attendance/heatmap')
  heatmap(@Query('institutionId') institutionId = 'default') {
    return this.svc.getAttendanceHeatmap(institutionId);
  }

  @Get('trends/yoy')
  yoyTrends(@Query('institutionId') institutionId = 'default') {
    return this.svc.getYoYTrends(institutionId);
  }
}
