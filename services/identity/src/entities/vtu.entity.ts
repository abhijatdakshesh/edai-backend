import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('vtu_windows')
export class VtuWindowEntity {
  @PrimaryColumn() id!: string;
  @Column() title!: string;
  @Column() openDate!: string;
  @Column() closeDate!: string;
  @Column('int') semester!: number;
  @Column({ default: false }) isActive!: boolean;
  @Column('text', { array: true, default: [] }) subjectCodes!: string[];
}

@Entity('vtu_eligibilities')
export class VtuEligibilityEntity {
  @PrimaryColumn() id!: string;
  @Column() windowId!: string;
  @Column() usn!: string;
  @Column('text', { array: true, default: [] }) eligibleSubjects!: string[];
  @Column({ default: false }) isEligible!: boolean;
  @Column({ default: 'REGULAR' }) category!: string;
}

@Entity('vtu_registrations')
export class VtuRegistrationEntity {
  @PrimaryColumn() id!: string;
  @Column() windowId!: string;
  @Column() usn!: string;
  @Column('text', { array: true, default: [] }) subjectCodes!: string[];
  @CreateDateColumn() registeredAt!: Date;
}
