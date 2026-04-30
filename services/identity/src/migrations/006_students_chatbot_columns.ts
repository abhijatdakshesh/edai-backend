import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 006 — Ensure students table has the four columns required by the
 * chatbot knowledge-graph and the risk-score view.
 *
 * TypeORM synchronize:true will also ADD these columns on startup, but it does
 * NOT back-fill existing rows — they stay NULL.  This migration adds the
 * columns AND populates them from existing data so they survive restarts.
 *
 * Safe to run multiple times (all DDL uses IF NOT EXISTS / DO NOTHING guards).
 */
export class StudentsChatbotColumns1700000000006 implements MigrationInterface {
  public readonly name = 'StudentsChatbotColumns1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Add columns idempotently ──────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS semester          INTEGER     DEFAULT 5,
        ADD COLUMN IF NOT EXISTS section           VARCHAR(20),
        ADD COLUMN IF NOT EXISTS department        VARCHAR(100),
        ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';
    `);

    // ── 2. Back-fill from existing columns ──────────────────────────────────
    // section: derive from section_id ("CS-A" → "A"); skip rows already set.
    await queryRunner.query(`
      UPDATE students
      SET section = SPLIT_PART(section_id, '-', 2)
      WHERE section IS NULL
        AND section_id IS NOT NULL
        AND section_id <> '';
    `);

    // department: infer from the section_id prefix; skip rows already set.
    await queryRunner.query(`
      UPDATE students
      SET department = CASE
            WHEN section_id LIKE 'CS-%' OR section_id LIKE 'CSE-%'
              THEN 'Computer Science & Engineering'
            WHEN section_id LIKE 'EC-%' OR section_id LIKE 'ECE-%'
              THEN 'Electronics & Communication Engineering'
            WHEN section_id LIKE 'ME-%'
              THEN 'Mechanical Engineering'
            WHEN section_id LIKE 'IS-%' OR section_id LIKE 'ISE-%'
              THEN 'Information Science & Engineering'
            WHEN section_id LIKE 'CV-%'
              THEN 'Civil Engineering'
            ELSE 'Engineering'
          END
      WHERE department IS NULL
        AND section_id IS NOT NULL
        AND section_id <> '';
    `);

    // preferred_language: copy from parent_preferred_language if present.
    await queryRunner.query(`
      UPDATE students
      SET preferred_language = COALESCE(parent_preferred_language, 'en')
      WHERE preferred_language IS NULL;
    `);

    // semester: default to 5 for any row still NULL.
    await queryRunner.query(`
      UPDATE students
      SET semester = 5
      WHERE semester IS NULL;
    `);

    // ── 3. Add NOT NULL defaults so future INSERTs without these fields work ─
    // (Don't make them NOT NULL — TypeORM synchronize would conflict on existing rows.)
    await queryRunner.query(`
      ALTER TABLE students
        ALTER COLUMN preferred_language SET DEFAULT 'en',
        ALTER COLUMN semester           SET DEFAULT 5;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Deliberately non-destructive: dropping these columns would lose data.
    // The down migration only removes the defaults.
    await queryRunner.query(`
      ALTER TABLE students
        ALTER COLUMN preferred_language DROP DEFAULT,
        ALTER COLUMN semester           DROP DEFAULT;
    `);
  }
}
