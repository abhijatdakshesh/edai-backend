import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type NotifyRole = 'FACULTY' | 'HOD' | 'PRINCIPAL';

@Entity({ name: 'alert_rules', schema: 'ews' })
export class AlertRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  threshold!: number;

  @Column({ type: 'varchar', length: 10 })
  level!: string;

  @Column({ name: 'notify_roles', type: 'text', array: true })
  notifyRoles!: NotifyRole[];

  @Column({ name: 'cooldown_hours', type: 'smallint', default: 72 })
  cooldownHours!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
