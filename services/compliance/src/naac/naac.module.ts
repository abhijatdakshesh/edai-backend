import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NaacCriterionSnapshotEntity } from './entities/naac-criterion-snapshot.entity';
import { NaacReportEntity } from './entities/naac-report.entity';
import { NaacCriterionCalculatorService } from './naac-criterion-calculator.service';
import { NaacController } from './naac.controller';
import { NaacReportProcessor } from './naac-report.processor';
import { NAAC_REPORT_QUEUE } from './naac-report.processor';
import { NaacService } from './naac.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NaacReportEntity, NaacCriterionSnapshotEntity]),
    BullModule.registerQueue({ name: NAAC_REPORT_QUEUE }),
  ],
  controllers: [NaacController],
  providers: [NaacService, NaacCriterionCalculatorService, NaacReportProcessor],
  exports: [NaacService],
})
export class NaacModule {}
