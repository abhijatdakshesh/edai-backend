import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { RiskService } from '../risk/risk.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, RiskService, AuditService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
