import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactors {
  attendance: number;
  marks: number;
  fees: number;
  assignments: number;
  exam_reg: number;
}

@Entity({ name: 'risk_snapshots', schema: 'ews' })
@Index(['studentId', 'snapshotAt'])
export class RiskSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 9 })
  academicYear!: string;

  @Column({ type: 'smallint' })
  semester!: number;

  @CreateDateColumn({ name: 'snapshot_at' })
  snapshotAt!: Date;

  @Column({ name: 'attendance_pct', type: 'numeric', precision: 5, scale: 2, nullable: true })
  attendancePct!: number | null;

  @Column({ name: 'marks_avg', type: 'numeric', precision: 5, scale: 2, nullable: true })
  marksAvg!: number | null;

  @Column({ name: 'assignments_submitted', type: 'smallint', nullable: true })
  assignmentsSubmitted!: number | null;

  @Column({ name: 'assignments_total', type: 'smallint', nullable: true })
  assignmentsTotal!: number | null;

  @Column({ name: 'fees_overdue_days', type: 'smallint', default: 0 })
  feesOverdueDays!: number;

  @Column({ name: 'exam_registered', type: 'boolean', default: true })
  examRegistered!: boolean;

  @Column({ name: 'risk_score', type: 'numeric', precision: 5, scale: 2 })
  riskScore!: number;

  @Column({ name: 'risk_level', type: 'varchar', length: 10 })
  riskLevel!: RiskLevel;

  @Column({ type: 'jsonb' })
  factors!: RiskFactors;
}
