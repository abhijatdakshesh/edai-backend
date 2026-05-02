import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportGenerator1700000000007 implements MigrationInterface {
  public readonly name = 'AddReportGenerator1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS report_generations (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_type     VARCHAR(50)  NOT NULL,
        requested_by    VARCHAR(255) NOT NULL,
        parameters      JSONB,
        status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
        pdf_size_bytes  INTEGER,
        emailed_to      TEXT[],
        error_message   TEXT,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        completed_at    TIMESTAMPTZ
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_report_gen_requested_by
        ON report_generations(requested_by, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS report_generations;`);
  }
}
