import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ReportStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
export type ReportFormat = 'PDF' | 'DOCX';

@Entity({ name: 'naac_reports', schema: 'naac' })
@Index(['institutionId', 'academicYear'])
export class NaacReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'institution_id', type: 'uuid' })
  institutionId!: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 9 })
  academicYear!: string;

  @Column({ name: 'generated_by', type: 'uuid' })
  generatedBy!: string;

  @CreateDateColumn({ name: 'triggered_at' })
  triggeredAt!: Date;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status!: ReportStatus;

  @Column({ type: 'varchar', length: 10, default: 'PDF' })
  format!: ReportFormat;

  @Column({ name: 's3_key', type: 'text', nullable: true })
  s3Key!: string | null;

  @Column({ name: 'criterion_scores', type: 'jsonb', nullable: true })
  criterionScores!: Record<string, unknown> | null;

  @Column({ name: 'error_detail', type: 'text', nullable: true })
  errorDetail!: string | null;
}
