import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EarlyWarningService, type AcknowledgeAlertDto, type ScoreStudentDto } from './early-warning.service';
import type { RiskFactor } from './entities/scoring-weight.entity';

@Controller('ews/v1')
export class EarlyWarningController {
  constructor(private readonly ews: EarlyWarningService) {}

  @Post('students/:studentId/score')
  scoreStudent(
    @Param('studentId') studentId: string,
    @Body() body: Omit<ScoreStudentDto, 'studentId'>,
  ) {
    return this.ews.scoreStudent({ ...body, studentId });
  }

  @Get('students/:studentId/risk')
  getLatestRisk(@Param('studentId') studentId: string) {
    return this.ews.getLatestRisk(studentId);
  }

  @Get('students/:studentId/risk-history')
  async getRiskHistory(
    @Param('studentId') studentId: string,
    @Query('days') days = '90',
  ) {
    const parsedDays = parseInt(days, 10);
    if (isNaN(parsedDays) || parsedDays < 1) {
      throw new BadRequestException('days must be a positive integer');
    }
    return this.ews.getRiskHistory(studentId, parsedDays);
  }

  @Get('alerts')
  getAlerts(@Query('studentId') studentId?: string) {
    return this.ews.getActiveAlerts(studentId);
  }

  @Patch('alerts/:alertId/acknowledge')
  acknowledge(
    @Param('alertId') alertId: string,
    @Body() body: AcknowledgeAlertDto,
  ) {
    return this.ews.acknowledgeAlert(alertId, body);
  }
}

/**
 * Admin endpoints for weight management.
 * TODO Phase 2: add @UseGuards(JwtAuthGuard) @Roles('ADMIN', 'PRINCIPAL') once
 * the identity service JWT guard is extracted to a shared package.
 */
@Controller('ews/v1/admin')
export class EwsAdminController {
  constructor(private readonly ews: EarlyWarningService) {}

  @Get('weights')
  getWeights() {
    return this.ews.getWeights();
  }

  @Post('weights')
  async updateWeights(@Body() body: { factor: RiskFactor; weight: number }[]) {
    if (!Array.isArray(body) || body.length === 0) {
      throw new BadRequestException('weights must be a non-empty array');
    }
    for (const u of body) {
      if (typeof u.weight !== 'number' || isNaN(u.weight)) {
        throw new BadRequestException(`Invalid weight for factor ${u.factor}: must be a finite number`);
      }
    }
    return this.ews.updateWeights(body);
  }
}
