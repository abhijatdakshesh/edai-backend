import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('promotion_batches')
export class PromotionBatchEntity {
  @PrimaryColumn() id!: string;
  @Column() className!: string;
  @Column('int') fromSemester!: number;
  @Column('int') toSemester!: number;
  @Column() academicYear!: string;
  @Column() dept!: string;
  @Column({ default: 'PENDING' }) status!: string;
  @Column({ nullable: true }) promotedAt!: string;
  @Column('jsonb', { nullable: true }) stats!: object;
  @CreateDateColumn() createdAt!: Date;
}

@Entity('promotion_audit_log')
export class PromotionAuditEntity {
  @PrimaryColumn() id!: string;
  @Column() batchId!: string;
  @Column() action!: string;
  @Column() actorId!: string;
  @Column() actorRole!: string;
  @Column({ nullable: true }) reason!: string;
  @Column('jsonb', { nullable: true }) overrides!: object;
  @Column() timestamp!: string;
}
