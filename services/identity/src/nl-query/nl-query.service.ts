import { Injectable, BadRequestException, InternalServerErrorException, Optional, Inject } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { geminiGenerate, GEMINI_SMART } from '../shared/gemini-ai';

const SCHEMA_CONTEXT = `
You are a PostgreSQL expert for EdAI, an Indian college ERP (RVCE, Bangalore).
Generate ONLY a single, read-only SELECT statement. No markdown, no explanation, no semicolon.

Tables available (column names are EXACT — use them as-is, quote camelCase columns):

  students(id UUID, user_id UUID, sap_id VARCHAR, usn VARCHAR, student_id VARCHAR,
           name VARCHAR, dob DATE, semester INT, section VARCHAR, department VARCHAR,
           cgpa NUMERIC, skills TEXT[],
           section_id VARCHAR, institution_id VARCHAR, home_state VARCHAR,
           parent_phone VARCHAR, parent_name VARCHAR, consent_voice BOOLEAN,
           "parent_preferred_language" VARCHAR, created_at TIMESTAMP)
           -- USN is the canonical student key (e.g. '1RV21CS001'); usn and student_id are mirrors.

  attendance(id UUID, student_id VARCHAR, subject_name VARCHAR, status VARCHAR,
             attendance_date DATE, created_at TIMESTAMP)
             -- status values: PRESENT, ABSENT, LATE
             -- one row per student per subject per date.

  internal_marks(id UUID, student_id VARCHAR, subject_name VARCHAR, exam_type VARCHAR,
                 marks_obtained NUMERIC, max_marks INT, created_at TIMESTAMP)
                 -- exam_type values: IA1, IA2, IA3, ASSIGNMENT

  fee_payments(id UUID, student_id VARCHAR, total_amount NUMERIC, paid_amount NUMERIC,
               payment_status VARCHAR, due_date DATE, created_at TIMESTAMP)
               -- payment_status values: PAID, PARTIAL, PENDING, OVERDUE

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

  student_risk_scores(id UUID, student_usn VARCHAR, risk_score NUMERIC, risk_level VARCHAR,
                      primary_concern VARCHAR, computed_at TIMESTAMP)
                      -- risk_level values: LOW, MEDIUM, HIGH, CRITICAL

  faculty(id UUID, emp_id VARCHAR, name VARCHAR, department VARCHAR,
          preferred_language VARCHAR, created_at TIMESTAMP)

  ai_call_logs(id VARCHAR, "studentUsn" VARCHAR, "studentName" VARCHAR, "parentId" VARCHAR,
               outcome VARCHAR, duration INT, "institutionId" VARCHAR, "classId" VARCHAR,
               "parentPhone" VARCHAR, transcript TEXT, summary TEXT, "calledAt" TIMESTAMP)
               -- outcome values: ANSWERED, NO_ANSWER, BUSY, FAILED

  consent_records(id VARCHAR, "principalId" VARCHAR, "institutionId" VARCHAR,
                  channels TEXT[], active BOOLEAN, "revokedAt" VARCHAR, "grantedAt" TIMESTAMP)

  announcements(id VARCHAR, title VARCHAR, content TEXT, audience VARCHAR,
                "institutionId" VARCHAR, "createdAt" TIMESTAMP)
                -- audience values: STUDENT, PARENT, FACULTY, ALL

  placement_drives(id UUID, company VARCHAR, status VARCHAR, scheduled_date DATE,
                   min_cgpa NUMERIC, rounds TEXT[], venue VARCHAR, eligible_depts TEXT[])

  recruiter_jobs(id UUID, recruiter_id UUID, title VARCHAR, ctc_lpa NUMERIC,
                 min_cgpa NUMERIC, location VARCHAR, status VARCHAR, posted_at TIMESTAMP)

  recruiter_applications(id UUID, job_id UUID, student_usn VARCHAR, status VARCHAR,
                         applied_at TIMESTAMP)
                         -- status values: APPLIED, SHORTLISTED, INTERVIEW, OFFERED, REJECTED

Rules:
  1. Return ONLY a valid PostgreSQL SELECT — nothing else.
  2. Never use INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE.
  3. Use ILIKE for case-insensitive string matching.
  4. camelCase column names MUST be quoted (e.g., "calledAt", "studentName"); snake_case columns are unquoted.
  5. For "this month" use "calledAt" >= date_trunc('month', now()); for "today" use CURRENT_DATE.
  6. Column aliases must be human-readable (e.g., "Student Name" not "studentName").
  7. Always add LIMIT 100 unless the question explicitly asks for a count or aggregate.
  8. If unanswerable from the schema, return exactly: SELECT 'Query not possible with available data' AS message

EXAMPLES (few-shot learning — match this style):

Q: How many students in CSE department semester 5?
SQL: SELECT COUNT(*) AS "Student Count" FROM students WHERE department ILIKE '%computer%' AND semester = 5

Q: Show students with attendance below 75% this semester
SQL: SELECT s.name AS "Student Name", s.usn AS "USN", s.department AS "Department", ROUND(COUNT(*) FILTER (WHERE a.status='PRESENT') * 100.0 / NULLIF(COUNT(*),0), 1) AS "Attendance %" FROM students s JOIN attendance a ON a.student_id = s.usn GROUP BY s.name, s.usn, s.department HAVING COUNT(*) FILTER (WHERE a.status='PRESENT') * 100.0 / NULLIF(COUNT(*),0) < 75 ORDER BY "Attendance %" ASC LIMIT 100

Q: List students with unpaid fees
SQL: SELECT s.name AS "Student Name", s.usn AS "USN", fi.component AS "Component", fi.amount AS "Amount", fi."dueDate" AS "Due Date" FROM students s JOIN fee_items fi ON fi.usn = s.usn WHERE fi.status = 'PENDING' ORDER BY fi."dueDate" ASC LIMIT 100

Q: How many AI calls were made this month and what was the outcome?
SQL: SELECT outcome AS "Outcome", COUNT(*) AS "Call Count" FROM ai_call_logs WHERE "calledAt" >= date_trunc('month', now()) GROUP BY outcome ORDER BY "Call Count" DESC
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

  constructor(
    @Optional() @Inject(getDataSourceToken()) private readonly dataSource: DataSource | null,
  ) {}

  async query(naturalLanguage: string): Promise<{
    sql: string;
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
  }> {
    if (!naturalLanguage?.trim()) throw new BadRequestException('Query cannot be empty');
    if (naturalLanguage.length > 500) throw new BadRequestException('Query too long — keep it under 500 characters');

    const question = naturalLanguage.trim();
    let sql = await this.generateSql(question);
    this.assertSafe(sql);

    // First execute attempt — on Postgres syntax/column error, give Gemini one
    // chance to self-correct using the actual error message. Many NL queries
    // fail on first try because of misnamed columns ("usn" vs "student_id");
    // a single re-prompt turns a 500 into a working answer (KAN-50/33).
    try {
      const rows = await this.execute(sql);
      return {
        sql,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
        rowCount: rows.length,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Retry only for SQL-level errors (column/table/syntax). Don't retry on
      // permission, connection, or our own assertSafe failures.
      const retriable = /column|relation|syntax|does not exist|undefined/i.test(errorMessage);
      if (!retriable) throw err;

      try {
        sql = await this.generateSqlWithFeedback(question, sql, errorMessage);
        this.assertSafe(sql);
        const rows = await this.execute(sql);
        return {
          sql,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          rows,
          rowCount: rows.length,
        };
      } catch {
        // Re-throw the original error — surface the first attempt's failure
        // so the user sees the most helpful diagnostic.
        throw err;
      }
    }
  }

  private async generateSql(question: string): Promise<string> {
    try {
      const combined = `${SCHEMA_CONTEXT}\n\nQuestion: ${question}`;
      const raw = await geminiGenerate(combined, GEMINI_SMART);
      const text = raw;
      if (!text?.trim()) throw new InternalServerErrorException('No SQL generated');
      return text.trim().replace(/^```(?:sql)?\n?/i, '').replace(/\n?```$/i, '').trim();
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      throw new InternalServerErrorException(`AI generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async generateSqlWithFeedback(question: string, prevSql: string, prevError: string): Promise<string> {
    const combined = `${SCHEMA_CONTEXT}

Question: ${question}

Your previous SQL attempt failed with PostgreSQL error:
  ${prevError}

Previous SQL:
  ${prevSql}

Generate a corrected SQL query. Pay attention to exact column names from the schema above.
Return ONLY the SQL — no markdown, no explanation.`;
    const raw = await geminiGenerate(combined, GEMINI_SMART);
    if (!raw?.trim()) throw new InternalServerErrorException('No corrected SQL generated');
    return raw.trim().replace(/^```(?:sql)?\n?/i, '').replace(/\n?```$/i, '').trim();
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
