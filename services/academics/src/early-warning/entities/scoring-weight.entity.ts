import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type RiskFactor = 'attendance' | 'marks' | 'fees' | 'assignments' | 'exam_reg';

@Entity({ name: 'ews_scoring_weights', schema: 'ews' })
export class ScoringWeightEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  factor!: RiskFactor;

  @Column({ type: 'numeric', precision: 4, scale: 2 })
  weight!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

export const DEFAULT_WEIGHTS: Record<RiskFactor, number> = {
  attendance: 0.35,
  marks: 0.30,
  fees: 0.15,
  assignments: 0.12,
  exam_reg: 0.08,
};
