import { Column, Entity, Index, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type LessonContentKind = 'MARKDOWN' | 'VIDEO' | 'SLIDES' | 'CODE';
export type ProgressState = 'NOT_STARTED' | 'IN_PROGRESS' | 'MASTERED';

export interface LessonContentBlock {
  kind: LessonContentKind;
  // For MARKDOWN: raw markdown body
  // For VIDEO:    youtube/vimeo/mp4 url
  // For SLIDES:   pdf/ppt url
  // For CODE:     starter code (language always 'python' in v1)
  data: string;
}

export interface CheckpointQuestion {
  q: string;
  options: string[];
  correctIndex: number;
}

@Entity({ name: 'lms_modules' })
@Index(['collegeId'])
@Index(['collegeId', 'courseId'])
export class ModuleEntity {
  @PrimaryColumn() id!: string;
  /** Tenant scope. RLS policy: college_id = current_setting('app.college_id')::uuid */
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() courseId!: string;
  @Column() title!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'int', default: 0 }) order!: number;
  @Column({ default: false }) published!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}

@Entity({ name: 'lms_lessons' })
@Index(['collegeId'])
@Index(['collegeId', 'moduleId'])
export class LessonEntity {
  @PrimaryColumn() id!: string;
  /** Tenant scope mirrors the parent module for RLS performance. */
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() moduleId!: string;
  @Column() title!: string;
  @Column({ type: 'int', default: 0 }) order!: number;
  @Column({ type: 'jsonb', default: () => "'[]'" }) contentBlocks!: LessonContentBlock[];
  @Column({ type: 'jsonb', default: () => "'[]'" }) checkpoint!: CheckpointQuestion[];
  @Column({ type: 'jsonb', default: () => "'[]'" }) topicTags!: string[];
  @Column({ default: false }) published!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}

@Entity({ name: 'lms_lesson_progress' })
@Index(['studentUsn', 'lessonId'], { unique: true })
@Index(['studentUsn'])
@Index(['collegeId', 'studentUsn'])
export class LessonProgressEntity {
  @PrimaryColumn() id!: string;
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() studentUsn!: string;
  @Column() lessonId!: string;
  @Column({ type: 'varchar', default: 'NOT_STARTED' }) state!: ProgressState;
  @Column({ type: 'int', default: 0 }) score!: number;
  @Column({ type: 'int', default: 0 }) attempts!: number;
  @UpdateDateColumn() updatedAt!: Date;
}

@Entity({ name: 'lms_topic_mastery' })
@Index(['studentUsn', 'courseId'])
@Index(['studentUsn', 'topic'], { unique: true })
@Index(['collegeId', 'studentUsn'])
export class TopicMasteryEntity {
  @PrimaryColumn() id!: string;
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() studentUsn!: string;
  @Column() courseId!: string;
  @Column() topic!: string;
  @Column({ type: 'float', default: 0 }) masteryScore!: number; // 0..1
  @UpdateDateColumn() updatedAt!: Date;
}
