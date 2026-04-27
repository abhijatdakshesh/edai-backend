import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, Partitioners } from 'kafkajs';

export interface EwsRiskScoredEvent {
  studentId: string;
  academicYear: string;
  semester: number;
  score: number;
  level: string;
  factors: Record<string, number> | object;
  snapshotId: string;
  ts: string;
}

export interface EwsAlertTriggeredEvent {
  studentId: string;
  snapshotId: string;
  level: string;
  ruleId: string;
  notifyRoles: string[];
  ts: string;
}

const TOPIC_RISK_SCORED = 'ews.risk.scored';
const TOPIC_ALERT_TRIGGERED = 'ews.alert.triggered';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer!: Producer;
  private connected = false;

  constructor(private readonly brokers: string[]) {}

  async onModuleInit(): Promise<void> {
    const kafka = new Kafka({ clientId: 'academics-svc', brokers: this.brokers });
    this.producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
    await this.producer.connect();
    this.connected = true;
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) await this.producer.disconnect();
  }

  async emitRiskScored(event: EwsRiskScoredEvent): Promise<void> {
    if (!this.connected) return;
    await this.producer.send({
      topic: TOPIC_RISK_SCORED,
      messages: [{ key: event.studentId, value: JSON.stringify(event) }],
    });
  }

  async emitAlertTriggered(event: EwsAlertTriggeredEvent): Promise<void> {
    if (!this.connected) return;
    await this.producer.send({
      topic: TOPIC_ALERT_TRIGGERED,
      messages: [{ key: event.studentId, value: JSON.stringify(event) }],
    });
  }
}
