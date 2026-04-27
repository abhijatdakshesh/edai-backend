import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'students' })
export class StudentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'sap_id', type: 'varchar', length: 20, nullable: true })
  sapId!: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  usn!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'date', nullable: true })
  dob!: string | null;

  @Column({ name: 'section_id', type: 'varchar', length: 20, nullable: true })
  sectionId!: string | null;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl!: string | null;

  @Column({ name: 'biometric_ref', type: 'varchar', length: 100, nullable: true })
  biometricRef!: string | null;

  @Column({ name: 'institution_id', type: 'varchar', length: 50 })
  institutionId!: string;

  @Column({ name: 'home_state', type: 'varchar', length: 50, nullable: true })
  homeState!: string | null;

  @Column({ name: 'parent_phone', type: 'varchar', length: 20, nullable: true })
  parentPhone!: string | null;

  @Column({ name: 'parent_name', type: 'varchar', length: 150, nullable: true })
  parentName!: string | null;

  @Column({ name: 'consent_voice', type: 'boolean', default: false })
  consentVoice!: boolean;

  @Column({ name: 'parent_preferred_language', type: 'varchar', length: 5, default: 'kn' })
  parentPreferredLanguage!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity({ name: 'parent_student_links' })
@Index(['parentId', 'studentId'], { unique: true })
export class ParentStudentLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'parent_id', type: 'uuid' })
  parentId!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ name: 'linked_at' })
  linkedAt!: Date;
}
