import { Module } from '@nestjs/common';
import { ReportGeneratorController } from './report-generator.controller';
import { ReportGeneratorService } from './report-generator.service';

@Module({
  controllers: [ReportGeneratorController],
  providers: [ReportGeneratorService],
  exports: [ReportGeneratorService],
})
export class ReportGeneratorModule {}
