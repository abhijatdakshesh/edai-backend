import { MigrationInterface, QueryRunner } from 'typeorm';

/** LMS Phases 2–6 extension tables (assignments, quizzes, discussions, hours, streaks). */
export class LmsExtensions1700000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lms_assignments (
        id VARCHAR PRIMARY KEY, college_id VARCHAR NOT NULL, lesson_id VARCHAR NOT NULL,
        title VARCHAR NOT NULL, description TEXT, submission_type VARCHAR DEFAULT 'CODE',
        published BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS lms_submissions (
        id VARCHAR PRIMARY KEY, college_id VARCHAR NOT NULL, assignment_id VARCHAR NOT NULL,
        student_usn VARCHAR NOT NULL, body TEXT NOT NULL, score FLOAT, feedback TEXT,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (assignment_id, student_usn)
      );
      CREATE TABLE IF NOT EXISTS lms_quiz_questions (
        id VARCHAR PRIMARY KEY, college_id VARCHAR NOT NULL, course_id VARCHAR NOT NULL,
        topic VARCHAR NOT NULL, question TEXT NOT NULL, options JSONB NOT NULL,
        correct_index INT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lms_discussion_posts (
        id VARCHAR PRIMARY KEY, college_id VARCHAR NOT NULL, lesson_id VARCHAR NOT NULL,
        author_usn VARCHAR NOT NULL, author_role VARCHAR NOT NULL, body TEXT NOT NULL,
        pinned BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS lms_lesson_prerequisites (
        lesson_id VARCHAR PRIMARY KEY, college_id VARCHAR NOT NULL, requires_lesson_id VARCHAR NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lms_learning_sessions (
        id VARCHAR PRIMARY KEY, college_id VARCHAR NOT NULL, student_usn VARCHAR NOT NULL,
        course_id VARCHAR NOT NULL, lesson_id VARCHAR NOT NULL,
        minutes INT DEFAULT 0, session_date DATE NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lms_streaks (
        id VARCHAR PRIMARY KEY, college_id VARCHAR NOT NULL, student_usn VARCHAR NOT NULL UNIQUE,
        current_streak INT DEFAULT 0, longest_streak INT DEFAULT 0, last_active_date DATE
      );
    `);
    await queryRunner.query(`
      INSERT INTO lms_lesson_prerequisites (lesson_id, college_id, requires_lesson_id)
      VALUES ('les-sjf', 'rvce', 'les-fcfs'), ('les-rr', 'rvce', 'les-sjf')
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of [
      'lms_streaks', 'lms_learning_sessions', 'lms_lesson_prerequisites',
      'lms_discussion_posts', 'lms_quiz_questions', 'lms_submissions', 'lms_assignments',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${t}`);
    }
  }
}
