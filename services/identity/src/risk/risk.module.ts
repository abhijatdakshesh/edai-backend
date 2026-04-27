import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
