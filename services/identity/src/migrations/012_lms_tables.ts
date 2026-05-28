import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LMS Phase 1 — modules, lessons, progress, topic mastery.
 * Seeds CS501 Process Scheduling pilot content when tables are empty.
 */
export class LmsTables1700000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lms_modules (
        id          VARCHAR PRIMARY KEY,
        college_id  VARCHAR NOT NULL,
        course_id   VARCHAR NOT NULL,
        title       VARCHAR NOT NULL,
        description TEXT,
        "order"     INT NOT NULL DEFAULT 0,
        published   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_lms_modules_college ON lms_modules(college_id);
      CREATE INDEX IF NOT EXISTS idx_lms_modules_course ON lms_modules(college_id, course_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lms_lessons (
        id             VARCHAR PRIMARY KEY,
        college_id     VARCHAR NOT NULL,
        module_id      VARCHAR NOT NULL REFERENCES lms_modules(id) ON DELETE CASCADE,
        title          VARCHAR NOT NULL,
        "order"        INT NOT NULL DEFAULT 0,
        content_blocks JSONB NOT NULL DEFAULT '[]',
        checkpoint     JSONB NOT NULL DEFAULT '[]',
        topic_tags     JSONB NOT NULL DEFAULT '[]',
        published      BOOLEAN NOT NULL DEFAULT FALSE,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_lms_lessons_college ON lms_lessons(college_id);
      CREATE INDEX IF NOT EXISTS idx_lms_lessons_module ON lms_lessons(college_id, module_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lms_lesson_progress (
        id          VARCHAR PRIMARY KEY,
        college_id  VARCHAR NOT NULL,
        student_usn VARCHAR NOT NULL,
        lesson_id   VARCHAR NOT NULL,
        state       VARCHAR NOT NULL DEFAULT 'NOT_STARTED',
        score       INT NOT NULL DEFAULT 0,
        attempts    INT NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (student_usn, lesson_id)
      );
      CREATE INDEX IF NOT EXISTS idx_lms_progress_usn ON lms_lesson_progress(student_usn);
      CREATE INDEX IF NOT EXISTS idx_lms_progress_college ON lms_lesson_progress(college_id, student_usn);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lms_topic_mastery (
        id            VARCHAR PRIMARY KEY,
        college_id    VARCHAR NOT NULL,
        student_usn   VARCHAR NOT NULL,
        course_id     VARCHAR NOT NULL,
        topic         VARCHAR NOT NULL,
        mastery_score FLOAT NOT NULL DEFAULT 0,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (student_usn, topic)
      );
      CREATE INDEX IF NOT EXISTS idx_lms_mastery_usn ON lms_topic_mastery(student_usn, course_id);
    `);

    const collegeId = process.env['DEFAULT_COLLEGE_ID'] ?? 'rvce';
    const existing = await queryRunner.query(
      `SELECT COUNT(*)::int AS c FROM lms_modules WHERE college_id = $1 AND course_id = $2`,
      [collegeId, 'CS501'],
    );
    if ((existing[0]?.c ?? 0) > 0) return;

    const modId = 'mod-os-scheduling';
    await queryRunner.query(
      `INSERT INTO lms_modules (id, college_id, course_id, title, description, "order", published)
       VALUES ($1, $2, 'CS501', 'Process Scheduling', $3, 1, TRUE)`,
      [modId, collegeId, 'How the OS decides which process runs next on the CPU.'],
    );

    const lessons: Array<{
      id: string;
      title: string;
      order: number;
      blocks: string;
      checkpoint: string;
      tags: string;
    }> = [
      {
        id: 'les-fcfs',
        title: 'First-Come First-Served (FCFS)',
        order: 1,
        blocks: JSON.stringify([
          { kind: 'MARKDOWN', data: '## FCFS Scheduling\n\nFirst-Come First-Served is the simplest CPU scheduling algorithm.' },
          { kind: 'CODE', data: '# FCFS example\nprint("hello")' },
        ]),
        checkpoint: JSON.stringify([
          { q: 'FCFS is best described as:', options: ['Preemptive', 'Non-preemptive', 'Round-robin', 'Priority-based'], correctIndex: 1 },
          { q: 'The "convoy effect" means:', options: ['CPU is idle', 'Short jobs wait behind long jobs', 'Disk is slow', 'I/O bound jobs starve'], correctIndex: 1 },
          { q: 'FCFS scheduling order is determined by:', options: ['Burst time', 'Priority', 'Arrival time', 'Random'], correctIndex: 2 },
        ]),
        tags: JSON.stringify(['scheduling', 'fcfs']),
      },
      {
        id: 'les-sjf',
        title: 'Shortest Job First (SJF)',
        order: 2,
        blocks: JSON.stringify([
          { kind: 'MARKDOWN', data: '## Shortest Job First\n\nSJF picks the process with the smallest next CPU burst.' },
          { kind: 'VIDEO', data: 'https://www.youtube.com/watch?v=2h3eWaPx8SA' },
        ]),
        checkpoint: JSON.stringify([
          { q: 'SJF minimises:', options: ['Throughput', 'Avg waiting time', 'CPU util', 'Response time'], correctIndex: 1 },
          { q: 'SJF requires:', options: ['Random selection', 'Knowing burst times in advance', 'Two CPUs', 'Priority list'], correctIndex: 1 },
          { q: 'SJF can be:', options: ['Only preemptive', 'Only non-preemptive', 'Either', 'Neither'], correctIndex: 2 },
        ]),
        tags: JSON.stringify(['scheduling', 'sjf']),
      },
      {
        id: 'les-rr',
        title: 'Round Robin (RR)',
        order: 3,
        blocks: JSON.stringify([
          { kind: 'MARKDOWN', data: '## Round Robin\n\nEach process gets a fixed time quantum then is preempted.' },
        ]),
        checkpoint: JSON.stringify([
          { q: 'Round Robin is:', options: ['Non-preemptive', 'Preemptive', 'Cooperative', 'Manual'], correctIndex: 1 },
          { q: 'A very small time quantum causes:', options: ['Better latency, lower throughput', 'Better throughput', 'CPU starvation', 'Disk thrashing'], correctIndex: 0 },
          { q: 'RR is best for:', options: ['Batch jobs', 'Interactive workloads', 'Real-time only', 'Memory-bound'], correctIndex: 1 },
        ]),
        tags: JSON.stringify(['scheduling', 'round-robin', 'time-slice']),
      },
    ];

    for (const l of lessons) {
      await queryRunner.query(
        `INSERT INTO lms_lessons (id, college_id, module_id, title, "order", content_blocks, checkpoint, topic_tags, published)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, TRUE)`,
        [l.id, collegeId, modId, l.title, l.order, l.blocks, l.checkpoint, l.tags],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lms_topic_mastery`);
    await queryRunner.query(`DROP TABLE IF EXISTS lms_lesson_progress`);
    await queryRunner.query(`DROP TABLE IF EXISTS lms_lessons`);
    await queryRunner.query(`DROP TABLE IF EXISTS lms_modules`);
  }
}
