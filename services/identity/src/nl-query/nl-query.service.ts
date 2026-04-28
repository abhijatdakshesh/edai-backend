import { Injectable, BadRequestException, InternalServerErrorException, Optional, Inject } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SCHEMA_CONTEXT = `
You are a PostgreSQL expert for EdAI, an Indian college ERP (RVCE, Bangalore).
Generate ONLY a single, read-only SELECT statement. No markdown, no explanation, no semicolon.

Tables available (column names are EXACT — use them as-is):

  students(id UUID, user_id UUID, sap_id VARCHAR, usn VARCHAR, name VARCHAR, dob DATE,
           section_id VARCHAR, institution_id VARCHAR, home_state VARCHAR,
           parent_phone VARCHAR, parent_name VARCHAR, consent_voice BOOLEAN,
           "parent_preferred_language" VARCHAR, created_at TIMESTAMP)

  parent_student_links(id UUID, parent_id UUID, student_id UUID, is_primary BOOLEAN,
                       linked_at TIMESTAMP)

  fee_items(id VARCHAR, usn VARCHAR, component VARCHAR, amount NUMERIC, status VARCHAR,
            "dueDate" VARCHAR, "paidDate" VARCHAR, semester INT, "institutionId" VARCHAR,
            "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP)
            -- status values: PENDING, PAID, WAIVED

  promotion_batches(id VARCHAR, "className" VARCHAR, "fromSemester" INT, "toSemester" INT,
                    "academicYear" VARCHAR, dept VARCHAR, status VARCHAR,
                    "promotedAt" VARCHAR, stats JSONB, "createdAt" TIMESTAMP)

  vtu_windows(id VARCHAR, title VARCHAR, "openDate" VARCHAR, "closeDate" VARCHAR,
              semester INT, "isActive" BOOLEAN, "subjectCodes" TEXT[])

  vtu_eligibilities(id VARCHAR, "windowId" VARCHAR, usn VARCHAR,
                    "eligibleSubjects" TEXT[], "isEligible" BOOLEAN, category VARCHAR)

  vtu_registrations(id VARCHAR, "windowId" VARCHAR, usn VARCHAR,
                    "subjectCodes" TEXT[], "registeredAt" TIMESTAMP)

  ai_call_logs(id VARCHAR, "studentUsn" VARCHAR, "studentName" VARCHAR, "parentId" VARCHAR,
               outcome VARCHAR, duration INT, "institutionId" VARCHAR, "classId" VARCHAR,
               "parentPhone" VARCHAR, transcript TEXT, summary TEXT, "calledAt" TIMESTAMP)
               -- outcome values: ANSWERED, NO_ANSWER, BUSY, FAILED

  consent_records(id VARCHAR, "principalId" VARCHAR, "institutionId" VARCHAR,
                  channels TEXT[], active BOOLEAN, "revokedAt" VARCHAR, "grantedAt" TIMESTAMP)

  announcements(id VARCHAR, title VARCHAR, content TEXT, audience VARCHAR,
                "institutionId" VARCHAR, "createdAt" TIMESTAMP)

Rules:
  1. Return ONLY a valid PostgreSQL SELECT — nothing else.
  2. Never use INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE.
  3. Use ILIKE for case-insensitive string matching.
  4. camelCase column names MUST be quoted (e.g., "calledAt", "studentName").
  5. For "this month" use "calledAt" >= date_trunc('month', now()); for "today" use CURRENT_DATE.
  6. Column aliases must be human-readable (e.g., "Student Name" not "studentName").
  7. If unanswerable from the schema, return exactly: SELECT 'Query not possible with available data' AS message
`;

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b/i;
const MAX_ROWS = 500;

@Injectable()
export class NlQueryService {
  static readonly SUGGESTIONS: string[] = [
    'Show students with unpaid fees',
    'List students eligible for VTU exam registration this semester',
    'How many AI calls were made this month and what was the outcome?',
    'Show students promoted to semester 6 in CSE department',
    'List all consent records where voice calling was not granted',
    'Which announcements were sent to students this month?',
    'Show students with parent preferred language as Kannada',
    'List fee items due this month that are not yet paid',
  ];

  private readonly genAI: GoogleGenerativeAI;

  constructor(
    @Optional() @Inject(getDataSourceToken()) private readonly dataSource: DataSource | null,
  ) {
    this.genAI = new GoogleGenerativeAI(process.env['GEMINI_API_KEY'] ?? '');
  }

  async query(naturalLanguage: string): Promise<{
    sql: string;
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
  }> {
    if (!naturalLanguage?.trim()) throw new BadRequestException('Query cannot be empty');
    if (naturalLanguage.length > 500) throw new BadRequestException('Query too long — keep it under 500 characters');

    const sql = await this.generateSql(naturalLanguage.trim());
    this.assertSafe(sql);
    const rows = await this.execute(sql);

    return {
      sql,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows,
      rowCount: rows.length,
    };
  }

  private async generateSql(question: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: SCHEMA_CONTEXT,
      });
      const result = await model.generateContent(question);
      const text = result.response.text();
      if (!text?.trim()) throw new InternalServerErrorException('No SQL generated');
      return text.trim().replace(/^```(?:sql)?\n?/i, '').replace(/\n?```$/i, '').trim();
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      throw new InternalServerErrorException(`AI generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private assertSafe(sql: string): void {
    const noStrings = sql.replace(/'[^']*'/g, "''");
    if (FORBIDDEN.test(noStrings)) throw new BadRequestException('Query contains disallowed statement type');
    const withoutTrailing = sql.trimEnd().replace(/;$/, '');
    if (withoutTrailing.includes(';')) throw new BadRequestException('Multi-statement queries are not allowed');
    if (!sql.trimStart().toLowerCase().startsWith('select')) throw new BadRequestException('Only SELECT queries are allowed');
  }

  private async execute(sql: string): Promise<Record<string, unknown>[]> {
    if (!this.dataSource) {
      throw new InternalServerErrorException(
        'Database not configured — set DATABASE_URL in the identity service environment',
      );
    }
    const hasLimit = /\bLIMIT\b/i.test(sql);
    const safeSql = hasLimit ? sql : `${sql.trimEnd().replace(/;$/, '')} LIMIT ${MAX_ROWS}`;
    try {
      return (await this.dataSource.query(safeSql)) as Record<string, unknown>[];
    } catch (err: unknown) {
      throw new BadRequestException(`SQL error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
