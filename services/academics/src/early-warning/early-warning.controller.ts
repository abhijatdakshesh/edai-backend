import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EarlyWarningService, type AcknowledgeAlertDto, type ScoreStudentDto } from './early-warning.service';

@Controller('ews/v1')
export class EarlyWarningController {
  constructor(private readonly ews: EarlyWarningService) {}

  @Post('students/:studentId/score')
  scoreStudent(
    @Param('studentId') studentId: string,
    @Body() body: Omit<ScoreStudentDto, 'studentId'>,
  ): unknown {
    return this.ews.scoreStudent({ ...body, studentId });
  }

  @Get('students/:studentId/risk')
  getLatestRisk(@Param('studentId') studentId: string): unknown {
    return this.ews.getLatestRisk(studentId);
  }

  @Get('students/:studentId/risk-history')
  getRiskHistory(
    @Param('studentId') studentId: string,
    @Query('days') days = '90',
  ): unknown {
    return this.ews.getRiskHistory(studentId, parseInt(days, 10));
  }

  @Get('alerts')
  getAlerts(@Query('studentId') studentId?: string): unknown {
    return this.ews.getActiveAlerts(studentId);
  }

  @Patch('alerts/:alertId/acknowledge')
  acknowledge(
    @Param('alertId') alertId: string,
    @Body() body: AcknowledgeAlertDto,
  ): unknown {
    return this.ews.acknowledgeAlert(alertId, body);
  }

  @Get('admin/weights')
  getWeights(): unknown {
    return this.ews.getWeights();
  }

  @Post('admin/weights')
  updateWeights(@Body() body: { factor: string; weight: number }[]): unknown {
    return this.ews.updateWeights(body as Parameters<typeof this.ews.updateWeights>[0]);
  }
}
