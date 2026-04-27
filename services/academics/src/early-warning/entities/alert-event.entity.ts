import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AlertRuleEntity } from './alert-rule.entity';

@Entity({ name: 'alert_events', schema: 'ews' })
export class AlertEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @ManyToOne(() => AlertRuleEntity, { nullable: true, onDelete: 'SET NULL' })
  rule!: AlertRuleEntity | null;

  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId!: string | null;

  @CreateDateColumn({ name: 'triggered_at' })
  triggeredAt!: Date;

  @Column({ name: 'notified_roles', type: 'text', array: true, nullable: true })
  notifiedRoles!: string[] | null;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy!: string | null;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
