import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertEventEntity } from './entities/alert-event.entity';
import { AlertRuleEntity } from './entities/alert-rule.entity';
import { RiskSnapshotEntity } from './entities/risk-snapshot.entity';
import { ScoringWeightEntity } from './entities/scoring-weight.entity';
import { EarlyWarningController } from './early-warning.controller';
import { EarlyWarningService } from './early-warning.service';
import { EwsRiskEngineService } from './ews-risk-engine.service';
import { KafkaProducerService } from './kafka-producer.service';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RiskSnapshotEntity,
      AlertRuleEntity,
      AlertEventEntity,
      ScoringWeightEntity,
    ]),
  ],
  controllers: [EarlyWarningController],
  providers: [
    EarlyWarningService,
    EwsRiskEngineService,
    {
      provide: KafkaProducerService,
      useFactory: () => new KafkaProducerService(KAFKA_BROKERS),
    },
  ],
  exports: [EarlyWarningService, EwsRiskEngineService],
})
export class EarlyWarningModule {}
