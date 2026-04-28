import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimetable1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS classrooms (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR NOT NULL UNIQUE,
        building    VARCHAR,
        capacity    SMALLINT DEFAULT 60,
        type        VARCHAR NOT NULL CHECK (type IN ('LECTURE','LAB','SEMINAR')),
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS timetable_configs (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        department              VARCHAR NOT NULL,
        semester                SMALLINT NOT NULL,
        academic_year           VARCHAR NOT NULL,
        sections                TEXT[] NOT NULL,
        working_days            TEXT[] NOT NULL DEFAULT '{"MON","TUE","WED","THU","FRI","SAT"}',
        periods_per_day         SMALLINT NOT NULL DEFAULT 7,
        period_duration_minutes SMALLINT NOT NULL DEFAULT 55,
        break_after_period      SMALLINT DEFAULT 4,
        status                  VARCHAR NOT NULL DEFAULT 'DRAFT'
                                  CHECK (status IN ('DRAFT','GENERATED','PUBLISHED')),
        created_by              VARCHAR NOT NULL DEFAULT 'system',
        created_at              TIMESTAMPTZ DEFAULT NOW(),
        generated_at            TIMESTAMPTZ,
        UNIQUE(department, semester, academic_year)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS timetable_subjects (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_id     UUID NOT NULL REFERENCES timetable_configs(id) ON DELETE CASCADE,
        subject_code  VARCHAR NOT NULL,
        subject_name  VARCHAR NOT NULL,
        subject_type  VARCHAR NOT NULL CHECK (subject_type IN ('THEORY','LAB','ELECTIVE')),
        credits       SMALLINT NOT NULL DEFAULT 4,
        hours_per_week SMALLINT NOT NULL,
        faculty_name  VARCHAR NOT NULL,
        faculty_id    VARCHAR,
        requires_lab  BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS idx_ts_config ON timetable_subjects(config_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS timetable_faculty_constraints (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_id         UUID NOT NULL REFERENCES timetable_configs(id) ON DELETE CASCADE,
        faculty_name      VARCHAR NOT NULL,
        unavailable_day   VARCHAR,
        unavailable_period SMALLINT,
        preferred_morning BOOLEAN DEFAULT FALSE,
        UNIQUE(config_id, faculty_name, unavailable_day, unavailable_period)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS timetable_slots (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_id      UUID NOT NULL REFERENCES timetable_configs(id) ON DELETE CASCADE,
        section        VARCHAR NOT NULL,
        day            VARCHAR NOT NULL CHECK (day IN ('MON','TUE','WED','THU','FRI','SAT')),
        period         SMALLINT NOT NULL CHECK (period BETWEEN 1 AND 8),
        subject_code   VARCHAR,
        subject_name   VARCHAR,
        subject_type   VARCHAR,
        faculty_name   VARCHAR,
        classroom_id   UUID REFERENCES classrooms(id),
        classroom_name VARCHAR,
        is_break       BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE(config_id, section, day, period)
      );
      CREATE INDEX IF NOT EXISTS idx_tsl_config_section ON timetable_slots(config_id, section, day);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS timetable_conflicts (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_id       UUID NOT NULL REFERENCES timetable_configs(id) ON DELETE CASCADE,
        conflict_type   VARCHAR NOT NULL
                          CHECK (conflict_type IN ('FACULTY_CLASH','ROOM_CLASH','HOURS_DEFICIT','CONSECUTIVE_VIOLATION','MAX_DAILY_VIOLATION')),
        description     TEXT NOT NULL,
        day             VARCHAR,
        period          SMALLINT,
        affected_entity VARCHAR,
        severity        VARCHAR NOT NULL DEFAULT 'ERROR' CHECK (severity IN ('ERROR','WARNING')),
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      INSERT INTO classrooms (name, building, capacity, type) VALUES
        ('LH-101', 'Main Block',    60, 'LECTURE'),
        ('LH-102', 'Main Block',    60, 'LECTURE'),
        ('LH-103', 'Main Block',    60, 'LECTURE'),
        ('LH-201', 'Main Block',    60, 'LECTURE'),
        ('LH-202', 'Main Block',    60, 'LECTURE'),
        ('LAB-CS-A', 'CS Block',    30, 'LAB'),
        ('LAB-CS-B', 'CS Block',    30, 'LAB'),
        ('LAB-EC-A', 'EC Block',    30, 'LAB'),
        ('SH-1', 'Seminar Block',  120, 'SEMINAR'),
        ('SH-2', 'Seminar Block',   80, 'SEMINAR')
      ON CONFLICT (name) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS timetable_conflicts;`);
    await queryRunner.query(`DROP TABLE IF EXISTS timetable_slots;`);
    await queryRunner.query(`DROP TABLE IF EXISTS timetable_faculty_constraints;`);
    await queryRunner.query(`DROP TABLE IF EXISTS timetable_subjects;`);
    await queryRunner.query(`DROP TABLE IF EXISTS timetable_configs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS classrooms;`);
  }
}
