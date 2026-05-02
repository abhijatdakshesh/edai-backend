import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** NAAC 7 criteria (1–7) */
export type NaacCriterion = 1 | 2 | 3 | 4 | 5 | 6 | 7;

@Entity({ name: 'naac_criterion_snapshots', schema: 'naac' })
@Index(['institutionId', 'academicYear', 'criterion', 'subCriterion', 'dataPeriodEnd'], { unique: true })
export class NaacCriterionSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'institution_id', type: 'uuid' })
  institutionId!: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 9 })
  academicYear!: string;

  @Column({ type: 'smallint' })
  criterion!: NaacCriterion;

  @Column({ name: 'sub_criterion', type: 'varchar', length: 10, nullable: true })
  subCriterion!: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  score!: number | null;

  @Column({ name: 'max_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  maxScore!: number | null;

  @Column({ name: 'data_payload', type: 'jsonb' })
  dataPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'computed_at' })
  computedAt!: Date;

  @Column({ name: 'data_period_end', type: 'date' })
  dataPeriodEnd!: string;
}
