import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fee_items')
export class FeeItemEntity {
  @PrimaryColumn() id!: string;
  @Column() usn!: string;
  @Column() component!: string;
  @Column('decimal', { precision: 10, scale: 2 }) amount!: number;
  @Column({ default: 'PENDING' }) status!: string;
  @Column({ nullable: true }) dueDate!: string;
  @Column({ nullable: true }) paidDate!: string;
  @Column({ default: 1 }) semester!: number;
  @Column({ default: 'default' }) institutionId!: string;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
