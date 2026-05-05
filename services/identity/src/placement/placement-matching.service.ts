import { Injectable, Logger, Optional } from '@nestjs/common';
import { claudeGenerate, CLAUDE_SMART } from '../shared/claude-ai';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface MatchResult {
  usn: string;
  fitScore: number;
  offerProbability: number;
  rationale: string;
}

// Strip newlines/injection chars from DB-sourced strings before prompt interpolation
function sanitizeForPrompt(value: unknown): string {
  return String(value ?? '').replace(/[\n\r\t]/g, ' ').slice(0, 200);
}

@Injectable()
export class PlacementMatchingService {
  private readonly logger = new Logger(PlacementMatchingService.name);

  constructor(@Optional() @InjectDataSource() private dataSource: DataSource) {}

  async matchStudentsToCompany(companyId: string): Promise<number> {
    const company = await this.dataSource.query(
      `SELECT * FROM placement_companies WHERE id = $1`, [companyId]
    );
    if (!company[0]) throw new Error('Company not found');
    const co = company[0] as Record<string, unknown>;

    const eligible = await this.dataSource.query(`
      SELECT prs.usn, prs.cgpa, prs.attendance_pct, prs.readiness_score, prs.department
      FROM placement_readiness_scores prs
      WHERE prs.cgpa >= $1
        AND prs.department = ANY($2::text[])
        AND prs.semester = ANY($3::int[])
        AND prs.backlogs = 0
      ORDER BY prs.readiness_score DESC
    `, [co['min_cgpa'], co['eligible_branches'], co['eligible_semesters']]) as Array<Record<string, unknown>>;

    if (eligible.length === 0) return 0;

    // Build allowlist of eligible USNs to validate Claude output
    const eligibleUsnSet = new Set(eligible.slice(0, 50).map(s => String(s['usn'])));

    const studentSummaries = eligible.slice(0, 50).map(s =>
      `USN: ${s['usn']} | CGPA: ${s['cgpa']} | Attendance: ${s['attendance_pct']}% | Readiness: ${s['readiness_score']} | Dept: ${s['department']}`
    ).join('\n');

    // Sanitize company fields to prevent prompt injection from DB-sourced strings
    const coName = sanitizeForPrompt(co['name']);
    const coRole = sanitizeForPrompt(co['role_offered']);
    const coType = sanitizeForPrompt(co['company_type']);
    const coSkills = (co['required_skills'] as string[] | null)?.map(sanitizeForPrompt).join(', ') || 'N/A';

    const prompt = `You are a placement officer evaluating students for ${coName}.

COMPANY: Role: ${coRole} | CTC: ${co['ctc_lpa']} LPA | Type: ${coType} | Min CGPA: ${co['min_cgpa']} | Skills: ${coSkills}

STUDENTS (score only the USNs listed here):
${studentSummaries}

Output a JSON array only — one entry per student, using the EXACT USNs from the list above:
[{"usn":"1RV21CS001","fitScore":85,"offerProbability":70,"rationale":"One sentence reason."}]

Score fit (0-100): CGPA 40%, attendance 20%, readiness 30%, profile 10%. Output ONLY the JSON array.`;

    let matches: MatchResult[] = [];

    try {
      const text = await claudeGenerate(prompt, CLAUDE_SMART);
      const json = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed: unknown = JSON.parse(json);

      // Guard: Claude must return an array of objects with the correct shape
      if (!Array.isArray(parsed)) throw new Error('Claude returned non-array');

      matches = (parsed as MatchResult[]).filter(m =>
        typeof m === 'object' && m !== null &&
        typeof m.usn === 'string' &&
        typeof m.fitScore === 'number' &&
        typeof m.offerProbability === 'number' &&
        // CRITICAL: only accept USNs from the eligible list — prevents hallucinated inserts
        eligibleUsnSet.has(m.usn)
      );
    } catch (err) {
      this.logger.error('Claude matching error — using fallback scorer', err);
      matches = eligible.slice(0, 50).map(s => ({
        usn: String(s['usn']),
        fitScore: Math.round(+String(s['readiness_score']) * 0.9),
        offerProbability: Math.round(+String(s['readiness_score']) * 0.7),
        rationale: `Score based on readiness index.`,
      }));
    }

    let saved = 0;
    for (const m of matches) {
      try {
        await this.dataSource.query(`
          INSERT INTO placement_matches (student_usn, company_id, fit_score, prediction_pct, claude_rationale)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (student_usn, company_id)
          DO UPDATE SET fit_score = $3, prediction_pct = $4, claude_rationale = $5
        `, [m.usn, companyId, m.fitScore, m.offerProbability, m.rationale]);
        saved++;
      } catch (e) {
        this.logger.warn(`Failed to save match for ${m.usn}: ${(e as Error).message}`);
      }
    }
    return saved;
  }

  async getMatchesForStudent(usn: string) {
    return this.dataSource.query(`
      SELECT pm.fit_score, pm.prediction_pct, pm.claude_rationale, pm.status,
             pc.name as company_name, pc.role_offered, pc.ctc_lpa,
             pc.company_type, pc.industry, pc.drive_date, pc.required_skills
      FROM placement_matches pm
      JOIN placement_companies pc ON pc.id = pm.company_id
      WHERE pm.student_usn = $1
      ORDER BY pm.fit_score DESC
    `, [usn]);
  }

  async getTopStudentsForCompany(companyId: string, limit = 15) {
    return this.dataSource.query(`
      SELECT pm.fit_score, pm.prediction_pct, pm.claude_rationale, pm.status,
             prs.name, prs.usn, prs.department, prs.cgpa, prs.attendance_pct, prs.readiness_score
      FROM placement_matches pm
      JOIN placement_readiness_scores prs ON prs.usn = pm.student_usn
      WHERE pm.company_id = $1
      ORDER BY pm.fit_score DESC
      LIMIT $2
    `, [companyId, limit]);
  }
}
