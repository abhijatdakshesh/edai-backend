import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('placement_drives')
export class PlacementDriveEntity {
  @PrimaryColumn() id!: string;
  @Column() company!: string;
  @Column() scheduledDate!: string;
  @Column() venue!: string;
  @Column('text', { array: true }) rounds!: string[];
  @Column('text', { array: true }) eligibleDepts!: string[];
  @Column('decimal', { precision: 4, scale: 2 }) minCgpa!: number;
  @Column({ default: 'SCHEDULED' }) status!: string;
  @Column('int', { default: 0 }) offersExtended!: number;
  @CreateDateColumn() createdAt!: Date;
}

@Entity('alumni_outcomes')
export class AlumniOutcomeEntity {
  @PrimaryColumn() usn!: string;
  @Column() name!: string;
  @Column('int') graduationYear!: number;
  @Column() company!: string;
  @Column() role!: string;
  @Column('decimal', { precision: 6, scale: 2 }) packageLpa!: number;
  @Column() dept!: string;
  @Column() location!: string;
}
