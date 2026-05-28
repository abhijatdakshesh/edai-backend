import { Column, Entity, Index, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'lms_assignments' })
@Index(['collegeId', 'lessonId'])
export class LmsAssignmentEntity {
  @PrimaryColumn() id!: string;
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() lessonId!: string;
  @Column() title!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'varchar', default: 'CODE' }) submissionType!: 'CODE' | 'TEXT';
  @Column({ default: true }) published!: boolean;
  @CreateDateColumn() createdAt!: Date;
}

@Entity({ name: 'lms_submissions' })
@Index(['assignmentId', 'studentUsn'], { unique: true })
export class LmsSubmissionEntity {
  @PrimaryColumn() id!: string;
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() assignmentId!: string;
  @Column() studentUsn!: string;
  @Column({ type: 'text' }) body!: string;
  @Column({ type: 'float', nullable: true }) score?: number;
  @Column({ type: 'text', nullable: true }) feedback?: string;
  @CreateDateColumn() submittedAt!: Date;
}

@Entity({ name: 'lms_quiz_questions' })
@Index(['collegeId', 'courseId', 'topic'])
export class LmsQuizQuestionEntity {
  @PrimaryColumn() id!: string;
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() courseId!: string;
  @Column() topic!: string;
  @Column({ type: 'text' }) question!: string;
  @Column({ type: 'jsonb' }) options!: string[];
  @Column({ type: 'int' }) correctIndex!: number;
}

@Entity({ name: 'lms_discussion_posts' })
@Index(['lessonId'])
export class LmsDiscussionPostEntity {
  @PrimaryColumn() id!: string;
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() lessonId!: string;
  @Column() authorUsn!: string;
  @Column() authorRole!: string;
  @Column({ type: 'text' }) body!: string;
  @Column({ default: false }) pinned!: boolean;
  @CreateDateColumn() createdAt!: Date;
}

@Entity({ name: 'lms_lesson_prerequisites' })
export class LmsLessonPrerequisiteEntity {
  @PrimaryColumn() lessonId!: string;
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() requiresLessonId!: string;
}

@Entity({ name: 'lms_learning_sessions' })
@Index(['studentUsn', 'courseId'])
export class LmsLearningSessionEntity {
  @PrimaryColumn() id!: string;
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() studentUsn!: string;
  @Column() courseId!: string;
  @Column() lessonId!: string;
  @Column({ type: 'int', default: 0 }) minutes!: number;
  @Column({ type: 'date' }) sessionDate!: string;
}

@Entity({ name: 'lms_streaks' })
@Index(['studentUsn'], { unique: true })
export class LmsStreakEntity {
  @PrimaryColumn() id!: string;
  @Column({ name: 'college_id' }) collegeId!: string;
  @Column() studentUsn!: string;
  @Column({ type: 'int', default: 0 }) currentStreak!: number;
  @Column({ type: 'int', default: 0 }) longestStreak!: number;
  @Column({ type: 'date', nullable: true }) lastActiveDate?: string;
}
