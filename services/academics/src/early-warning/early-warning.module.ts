import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertEventEntity } from './entities/alert-event.entity';
import { AlertRuleEntity } from './entities/alert-rule.entity';
import { RiskSnapshotEntity } from './entities/risk-snapshot.entity';
import { ScoringWeightEntity } from './entities/scoring-weight.entity';
import { EarlyWarningController, EwsAdminController } from './early-warning.controller';
import { EarlyWarningService } from './early-warning.service';
import { EwsRiskEngineService } from './ews-risk-engine.service';
import { KafkaProducerService } from './kafka-producer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RiskSnapshotEntity,
      AlertRuleEntity,
      AlertEventEntity,
      ScoringWeightEntity,
    ]),
  ],
  controllers: [EarlyWarningController, EwsAdminController],
  providers: [
    EarlyWarningService,
    EwsRiskEngineService,
    {
      provide: KafkaProducerService,
      // Brokers resolved at factory call time (not module parse time)
      useFactory: () => new KafkaProducerService(
        (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
      ),
    },
  ],
  exports: [EarlyWarningService, EwsRiskEngineService],
})
export class EarlyWarningModule {}
