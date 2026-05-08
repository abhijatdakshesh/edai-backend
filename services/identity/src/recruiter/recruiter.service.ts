import { Injectable, Logger, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { claudeGenerate, CLAUDE_FAST } from '../shared/claude-ai';
import { randomUUID } from 'node:crypto';

function sanitize(v: unknown, maxLen = 300): string {
  return String(v ?? '').replace(/[\n\r\t]/g, ' ').slice(0, maxLen);
}

export interface PostJobDto {
  title: string;
  description?: string;
  companyName?: string;
  roleType?: 'PRODUCT' | 'SERVICE' | 'STARTUP' | 'CORE';
  ctcLpa?: number;
  minCgpa?: number;
  eligibleBranches?: string[];
  eligibleSemesters?: number[];
  requiredSkills?: string[];
  location?: string;
  applyDeadline?: string;
}

export interface CandidateFilter {
  branch?: string;
  semester?: number;
  minCgpa?: number;
  minPlacementScore?: number;
  skills?: string[];
  limit?: number;
}

@Injectable()
export class RecruiterService {
  private readonly logger = new Logger(RecruiterService.name);

  constructor(@Optional() @InjectDataSource() private ds: DataSource) {}

  // ── Job CRUD ──────────────────────────────────────────────────────────────

  async postJob(recruiterId: string, institutionId: string, dto: PostJobDto): Promise<{ id: string }> {
    // Server-side defaults so the form posts even when optional fields are omitted
    const description = (dto.description?.trim() || `${dto.title} role with ${dto.companyName ?? 'the company'}.`);
    const roleType = dto.roleType ?? 'SERVICE';
    const ctcLpa = dto.ctcLpa ?? 0;
    const minCgpa = dto.minCgpa ?? 0;
    const eligibleBranches = dto.eligibleBranches?.length ? dto.eligibleBranches : ['CSE', 'ISE', 'ECE'];
    const eligibleSemesters = dto.eligibleSemesters?.length ? dto.eligibleSemesters : [7, 8];
    const requiredSkills = dto.requiredSkills ?? [];
    const location = dto.location ?? 'Bengaluru';
    const applyDeadline = dto.applyDeadline ?? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    const [row] = await this.ds.query(`
      INSERT INTO recruiter_jobs
        (id, recruiter_id, institution_id, title, description, role_type,
         ctc_lpa, min_cgpa, eligible_branches, eligible_semesters,
         required_skills, location, apply_deadline, status, posted_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'OPEN',NOW())
      RETURNING id
    `, [
      randomUUID(), recruiterId, institutionId,
      dto.title, description, roleType,
      ctcLpa, minCgpa, eligibleBranches, eligibleSemesters,
      requiredSkills, location, applyDeadline,
    ]);
    this.logger.log(`Job posted id=${row.id} recruiter=${recruiterId}`);
    return row;
  }

  async listMyJobs(recruiterId: string): Promise<unknown[]> {
    return this.ds.query(`
      SELECT rj.*,
        COUNT(DISTINCT ja.id) FILTER (WHERE ja.status = 'APPLIED') as applicant_count,
        COUNT(DISTINCT ja.id) FILTER (WHERE ja.status = 'SHORTLISTED') as shortlisted_count,
        COUNT(DISTINCT ja.id) FILTER (WHERE ja.status = 'OFFERED') as offer_count
      FROM recruiter_jobs rj
      LEFT JOIN recruiter_applications ja ON ja.job_id = rj.id
      WHERE rj.recruiter_id = $1
      GROUP BY rj.id
      ORDER BY rj.posted_at DESC
    `, [recruiterId]);
  }

  async getJob(jobId: string, recruiterId: string): Promise<unknown> {
    const [job] = await this.ds.query(
      `SELECT * FROM recruiter_jobs WHERE id = $1`, [jobId]
    );
    if (!job) throw new NotFoundException('Job not found');
    if ((job as { recruiter_id: string }).recruiter_id !== recruiterId) {
      throw new ForbiddenException('Not your job posting');
    }
    return job;
  }

  async closeJob(jobId: string, recruiterId: string): Promise<void> {
    await this.getJob(jobId, recruiterId);
    await this.ds.query(
      `UPDATE recruiter_jobs SET status = 'CLOSED' WHERE id = $1`, [jobId]
    );
  }

  // ── Applicant management ──────────────────────────────────────────────────

  async getApplicants(jobId: string, recruiterId: string): Promise<unknown[]> {
    await this.getJob(jobId, recruiterId);
    return this.ds.query(`
      SELECT
        ja.id as application_id, ja.student_usn, ja.status, ja.applied_at,
        s.name, s.department, s.semester, s.cgpa, s.skills,
        prs.readiness_score as placement_score
      FROM recruiter_applications ja
      JOIN students s ON s.student_id = ja.student_usn
      LEFT JOIN placement_readiness_scores prs ON prs.usn = ja.student_usn
      WHERE ja.job_id = $1
      ORDER BY prs.readiness_score DESC NULLS LAST
    `, [jobId]);
  }

  async updateApplicationStatus(
    jobId: string,
    recruiterId: string,
    studentUsn: string,
    status: 'SHORTLISTED' | 'INTERVIEW' | 'OFFERED' | 'REJECTED',
  ): Promise<void> {
    await this.getJob(jobId, recruiterId);
    await this.ds.query(`
      UPDATE recruiter_applications SET status = $1, updated_at = NOW()
      WHERE job_id = $2 AND student_usn = $3
    `, [status, jobId, studentUsn]);
  }

  async bulkShortlist(jobId: string, recruiterId: string, studentUsns: string[]): Promise<{ updated: number }> {
    await this.getJob(jobId, recruiterId);
    const result = await this.ds.query(`
      UPDATE recruiter_applications SET status = 'SHORTLISTED', updated_at = NOW()
      WHERE job_id = $1 AND student_usn = ANY($2) AND status = 'APPLIED'
      RETURNING id
    `, [jobId, studentUsns]);
    return { updated: result.length };
  }

  // ── Candidate search ──────────────────────────────────────────────────────

  async searchCandidates(institutionId: string, filter: CandidateFilter): Promise<unknown[]> {
    const limit = Math.min(filter.limit ?? 50, 200);
    const conditions: string[] = ['s.institution_id = $1'];
    const params: unknown[] = [institutionId];
    let p = 2;

    if (filter.branch && !filter.branch.includes('|')) {
      conditions.push(`s.department = $${p++}`); params.push(filter.branch);
    }
    if (filter.semester) { conditions.push(`s.semester = $${p++}::text`); params.push(String(filter.semester)); }
    if (filter.minCgpa) { conditions.push(`s.cgpa >= $${p++}`); params.push(filter.minCgpa); }
    if (filter.minPlacementScore) { conditions.push(`prs.readiness_score >= $${p++}`); params.push(filter.minPlacementScore); }
    if (filter.skills?.length) { conditions.push(`s.skills && $${p++}::text[]`); params.push(filter.skills); }

    return this.ds.query(`
      SELECT s.student_id, s.name, s.email, s.department, s.semester, s.cgpa,
             s.skills, prs.readiness_score as placement_score,
             COUNT(pm.id) as company_matches
      FROM students s
      LEFT JOIN placement_readiness_scores prs ON prs.usn = s.student_id
      LEFT JOIN placement_matches pm ON pm.student_usn = s.student_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY s.student_id, s.name, s.email, s.department, s.semester,
               s.cgpa, s.skills, prs.readiness_score
      ORDER BY prs.readiness_score DESC NULLS LAST
      LIMIT $${p}
    `, [...params, limit]);
  }

  // ── AI: Rank candidates for a job ────────────────────────────────────────

  async aiRankCandidates(jobId: string, recruiterId: string): Promise<unknown[]> {
    const job = await this.getJob(jobId, recruiterId) as Record<string, unknown>;
    const candidates = await this.ds.query(`
      SELECT s.student_id, s.name, s.department, s.semester, s.cgpa,
             s.skills, prs.readiness_score
      FROM recruiter_applications ja
      JOIN students s ON s.student_id = ja.student_usn
      LEFT JOIN placement_readiness_scores prs ON prs.usn = ja.student_usn
      WHERE ja.job_id = $1 AND ja.status = 'APPLIED'
      LIMIT 50
    `, [jobId]);

    if (!candidates.length) return [];

    const candidateList = (candidates as Record<string, unknown>[]).map((c, i) =>
      `${i + 1}. USN=${sanitize(c['student_id'])} name=${sanitize(c['name'])} dept=${sanitize(c['department'])} cgpa=${c['cgpa']} skills=${sanitize(JSON.stringify(c['skills']))} score=${c['readiness_score'] ?? 'N/A'}`
    ).join('\n');

    const prompt = `You are a technical recruiter. Rank these ${candidates.length} candidates for:
Role: ${sanitize(job['title'])}
Required Skills: ${sanitize(JSON.stringify(job['required_skills']))}
Min CGPA: ${job['min_cgpa']}
Role Type: ${sanitize(job['role_type'])}

Candidates:
${candidateList}

Return a JSON array ranked best-to-worst: [{"usn":"...", "rank":1, "fitScore":85, "rationale":"..."}]
Return ONLY the JSON array, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      const parsed = JSON.parse(text.replace(/^```json\n?|```$/g, ''));
      return parsed;
    } catch (err) {
      this.logger.warn('AI ranking failed, returning unranked list', err);
      return candidates.map((c: Record<string, unknown>, i: number) => ({
        usn: c['student_id'], rank: i + 1, fitScore: null, rationale: 'AI ranking unavailable',
      }));
    }
  }

  // ── AI: Generate job description ─────────────────────────────────────────

  async aiGenerateJd(params: {
    roleTitle: string;
    companyName: string;
    roleType: string;
    requiredSkills: string[];
    ctcLpa: number;
  }): Promise<{ title: string; description: string; requirements: string[] }> {
    const prompt = `Generate a professional job description for a ${sanitize(params.roleType)} company hiring for Indian engineering college students (final year).

Role: ${sanitize(params.roleTitle)}
Company type: ${sanitize(params.roleType)}
Required skills: ${sanitize(params.requiredSkills.join(', '))}
CTC: ₹${params.ctcLpa} LPA

Return JSON: {"title":"...","description":"2-3 paragraph JD","requirements":["req1","req2",...8 items]}
Return ONLY the JSON, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch {
      return {
        title: params.roleTitle,
        description: `${params.companyName} is hiring for ${params.roleTitle}. Join our team and work on cutting-edge ${params.roleType.toLowerCase()} products.`,
        requirements: params.requiredSkills.map(s => `Proficiency in ${s}`),
      };
    }
  }

  // ── AI: Generate interview questions ─────────────────────────────────────

  async aiInterviewQuestions(params: {
    roleTitle: string;
    roleType: string;
    requiredSkills: string[];
    round: 'APTITUDE' | 'TECHNICAL' | 'HR';
  }): Promise<{ question: string; expectedAnswer: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD' }[]> {
    const prompt = `Generate 10 ${sanitize(params.round)} interview questions for:
Role: ${sanitize(params.roleTitle)}
Company type: ${sanitize(params.roleType)}
Skills: ${sanitize(params.requiredSkills.join(', '))}

Return JSON array: [{"question":"...","expectedAnswer":"brief answer","difficulty":"EASY|MEDIUM|HARD"}]
Return ONLY the JSON array, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch {
      return [{ question: `Explain your experience with ${params.requiredSkills[0] ?? 'programming'}`, expectedAnswer: 'Varies by candidate', difficulty: 'MEDIUM' }];
    }
  }

  // ── AI: NL candidate search ───────────────────────────────────────────────

  async aiCandidateSearch(institutionId: string, query: string): Promise<{
    filter: CandidateFilter;
    candidates: unknown[];
    interpretation: string;
  }> {
    const prompt = `Parse this recruiter candidate search query into structured filters for an Indian engineering college database.

Query: "${sanitize(query)}"

Available branches: CSE, ISE, ECE, EEE, ME, CV, CH, BT
Semesters: 1-8, CGPA: 0.0-10.0, Skills: any technology name

Rules:
- branch: set to a SINGLE branch code (CSE/ISE/ECE/EEE/ME/CV/CH/BT) ONLY if the query targets one specific branch; use null if multiple branches or "any branch"
- semester: integer 1-8 or null; "final year" means 8
- minCgpa: number or null
- minPlacementScore: number 0-100 or null
- skills: array of skill names or null

Return JSON: {"branch":"CSE","semester":8,"minCgpa":8.0,"minPlacementScore":null,"skills":["Python"],"interpretation":"plain English explanation"}
Return ONLY the JSON, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      const filter = JSON.parse(text.replace(/^```json\n?|```$/g, ''));
      const { interpretation, ...candidateFilter } = filter as CandidateFilter & { interpretation: string };
      const candidates = await this.searchCandidates(institutionId, { ...candidateFilter, limit: 50 });
      return { filter: candidateFilter, candidates, interpretation: interpretation ?? query };
    } catch {
      const candidates = await this.searchCandidates(institutionId, { limit: 50 });
      return { filter: {}, candidates, interpretation: 'Could not parse query — showing all candidates' };
    }
  }

  // ── AI: Semantic JD match ─────────────────────────────────────────────────

  async aiSemanticMatch(institutionId: string, jdText: string): Promise<unknown[]> {
    const candidates = await this.searchCandidates(institutionId, { limit: 50 });
    if (!candidates.length) return [];

    const jdSnippet = sanitize(jdText, 2000);
    const candidateList = (candidates as Record<string, unknown>[]).map((c, i) =>
      `${i + 1}. USN=${sanitize(c['student_id'])} name=${sanitize(c['name'])} dept=${sanitize(c['department'])} cgpa=${c['cgpa']} skills=${sanitize(JSON.stringify(c['skills']))}`
    ).join('\n');

    const prompt = `You are a technical recruiter. Given this job description, semantically rank the candidates by fit.

Job Description: ${jdSnippet}

Candidates:
${candidateList}

Return JSON array (top 10 max): [{"usn":"...","matchScore":85,"matchReasons":["reason1","reason2"]}]
Return ONLY the JSON array, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch (err) {
      this.logger.warn('Semantic match failed', err);
      return (candidates as Record<string, unknown>[]).slice(0, 5).map(c => ({
        usn: c['student_id'], matchScore: 70, matchReasons: ['AI unavailable — showing top candidates by placement score'],
      }));
    }
  }

  // ── AI: Look-alike search ─────────────────────────────────────────────────

  async aiLookAlike(institutionId: string, targetUsn: string): Promise<unknown[]> {
    // Fix 1: always scope target lookup to the recruiter's own institution
    const [targetStudent] = await this.ds.query(
      `SELECT student_id, name, department, semester, cgpa, skills FROM students WHERE student_id = $1 AND institution_id = $2`,
      [targetUsn, institutionId],
    );
    if (!targetStudent) return [];

    const others = await this.ds.query(`
      SELECT student_id, name, department, semester, cgpa, skills
      FROM students WHERE institution_id = $1 AND student_id != $2 LIMIT 50
    `, [institutionId, targetUsn]);

    if (!others.length) return [];

    const target = targetStudent as Record<string, unknown>;
    const otherList = (others as Record<string, unknown>[]).map((c, i) =>
      `${i + 1}. USN=${sanitize(c['student_id'])} dept=${sanitize(c['department'])} cgpa=${c['cgpa']} skills=${sanitize(JSON.stringify(c['skills']))}`
    ).join('\n');

    const prompt = `Find candidates most similar to this profile:
Target: dept=${sanitize(target['department'])} cgpa=${target['cgpa']} skills=${sanitize(JSON.stringify(target['skills']))}

Candidates:
${otherList}

Return JSON array (top 5): [{"usn":"...","similarityScore":88,"sharedTraits":["trait1","trait2"]}]
Return ONLY the JSON array, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch (err) {
      this.logger.warn('Look-alike failed', err);
      return (others as Record<string, unknown>[]).slice(0, 3).map(c => ({
        usn: c['student_id'], similarityScore: 75, sharedTraits: ['Same department', 'Similar CGPA range'],
      }));
    }
  }

  // ── AI: Hidden gems ───────────────────────────────────────────────────────

  async aiHiddenGems(institutionId: string, filter: CandidateFilter): Promise<unknown[]> {
    const { minCgpa: _ignored, ...filterWithoutCgpa } = filter;
    const candidates = await this.searchCandidates(institutionId, { ...filterWithoutCgpa, limit: 80 });
    if (!candidates.length) return [];

    const candidateList = (candidates as Record<string, unknown>[]).map((c, i) =>
      `${i + 1}. USN=${sanitize(c['student_id'])} name=${sanitize(c['name'])} cgpa=${c['cgpa']} score=${c['placement_score'] ?? 'N/A'} skills=${sanitize(JSON.stringify(c['skills']))}`
    ).join('\n');

    const prompt = `Identify "hidden gem" candidates — high-potential students who might be overlooked by strict CGPA filters but show strong signals.

Candidates:
${candidateList}

Return JSON array (top 5, focus on non-obvious picks): [{"usn":"...","gemScore":82,"signals":["signal1","signal2"]}]
Signals could include: high placement score despite average CGPA, diverse skill set, strong technical skills.
Return ONLY the JSON array, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch (err) {
      this.logger.warn('Hidden gems failed', err);
      return (candidates as Record<string, unknown>[]).slice(0, 3).map(c => ({
        usn: c['student_id'], gemScore: 75, signals: ['Strong skill set', 'High placement readiness score'],
      }));
    }
  }

  // ── AI: Skill adjacency ───────────────────────────────────────────────────

  async aiSkillAdjacency(institutionId: string, targetSkill: string, location?: string): Promise<unknown[]> {
    const candidates = await this.ds.query(`
      SELECT s.student_id, s.name, s.department, s.cgpa, s.skills
      FROM students s
      WHERE s.institution_id = $1
      LIMIT 50
    `, [institutionId]);

    if (!candidates.length) return [];

    const candidateList = (candidates as Record<string, unknown>[]).map((c, i) =>
      `${i + 1}. USN=${sanitize(c['student_id'])} name=${sanitize(c['name'])} skills=${sanitize(JSON.stringify(c['skills']))}`
    ).join('\n');

    const prompt = `For each candidate, assess their readiness to learn "${sanitize(targetSkill)}" based on their existing skills.${location ? ` Target location: ${sanitize(location)}.` : ''}

Candidates:
${candidateList}

Return JSON array: [{"usn":"...","targetSkillMatch":true,"adjacentSkills":["Python","SQL"],"estimatedRampWeeks":4}]
targetSkillMatch = true if they already have the skill, false otherwise.
estimatedRampWeeks = weeks to get productive (2-16 range).
Return ONLY the JSON array, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch (err) {
      this.logger.warn('Skill adjacency failed', err);
      return (candidates as Record<string, unknown>[]).slice(0, 3).map(c => ({
        usn: c['student_id'], targetSkillMatch: false, adjacentSkills: [], estimatedRampWeeks: 8,
      }));
    }
  }

  // ── AI: JD Improver ───────────────────────────────────────────────────────

  async aiJdImprove(params: { jdText: string; ctcLpa: number; minCgpa: number; location: string }): Promise<{
    suggestions: string[];
    poolImpact: string;
    inclusiveScore: number;
  }> {
    const prompt = `Analyze this job description for an Indian engineering campus placement drive and suggest improvements to maximize candidate pool size and quality.

Job Description: ${sanitize(params.jdText, 2000)}
CTC: ₹${params.ctcLpa} LPA
Min CGPA: ${params.minCgpa}
Location: ${sanitize(params.location)}

Return JSON: {"suggestions":["suggestion1","suggestion2","suggestion3"],"poolImpact":"e.g. Lowering CGPA to 7.0 expands pool by ~40%","inclusiveScore":75}
inclusiveScore: 0-100, higher is more inclusive language.
Return ONLY the JSON, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch (err) {
      this.logger.warn('JD improve failed', err);
      return {
        suggestions: ['Consider broadening eligible branches', 'Add remote/hybrid work options', 'Clarify growth opportunities'],
        poolImpact: 'AI analysis unavailable',
        inclusiveScore: 70,
      };
    }
  }

  // ── AI: Inclusive language check ──────────────────────────────────────────

  async aiInclusiveCheck(jdText: string): Promise<{
    flagged: { phrase: string; suggestion: string; reason: string }[];
    overallScore: number;
  }> {
    const prompt = `Check this job description for exclusionary, biased, or non-inclusive language targeting Indian engineering college graduates.

Job Description: ${sanitize(jdText, 2000)}

Return JSON: {"flagged":[{"phrase":"rockstar","suggestion":"high-performer","reason":"gendered/exclusionary term"}],"overallScore":85}
overallScore: 0-100, higher = more inclusive. If no issues found, return flagged=[].
Return ONLY the JSON, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch (err) {
      this.logger.warn('Inclusive check failed', err);
      return { flagged: [], overallScore: 80 };
    }
  }

  // ── AI: Salary benchmark ──────────────────────────────────────────────────

  async aiSalaryBenchmark(params: {
    roleTitle: string;
    roleType: string;
    location: string;
    requiredSkills: string[];
  }): Promise<{ suggestedMin: number; suggestedMax: number; median: number; reasoning: string }> {
    const prompt = `Suggest a competitive salary range (in LPA) for this campus placement role at a Tier-1 Karnataka engineering college (like RVCE/BMS) for the 2025-26 batch.

Role: ${sanitize(params.roleTitle)}
Company type: ${sanitize(params.roleType)}
Location: ${sanitize(params.location)}
Skills required: ${sanitize(params.requiredSkills.join(', '))}

Return JSON: {"suggestedMin":8,"suggestedMax":12,"median":10,"reasoning":"Based on 2025-26 Karnataka campus placement data..."}
Numbers in LPA (Lakhs Per Annum). Return ONLY the JSON, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch (err) {
      this.logger.warn('Salary benchmark failed', err);
      return { suggestedMin: 6, suggestedMax: 12, median: 8, reasoning: 'AI benchmark unavailable — using typical Karnataka campus ranges' };
    }
  }

  // ── AI: Offer prediction ──────────────────────────────────────────────────

  async aiOfferPrediction(jobId: string, recruiterId: string): Promise<unknown[]> {
    const job = await this.getJob(jobId, recruiterId) as Record<string, unknown>;
    const shortlisted = await this.ds.query(`
      SELECT s.student_id, s.name, s.department, s.cgpa, s.skills, prs.readiness_score
      FROM recruiter_applications ja
      JOIN students s ON s.student_id = ja.student_usn
      LEFT JOIN placement_readiness_scores prs ON prs.usn = ja.student_usn
      WHERE ja.job_id = $1 AND ja.status IN ('SHORTLISTED', 'INTERVIEW', 'OFFERED')
      LIMIT 30
    `, [jobId]);

    if (!shortlisted.length) return [];

    // Check for competing offers (student has OFFERED status on another job)
    const usns = (shortlisted as Record<string, unknown>[]).map(c => c['student_id']);
    const competingOffers = await this.ds.query(`
      SELECT DISTINCT student_usn FROM recruiter_applications
      WHERE student_usn = ANY($1::text[]) AND status = 'OFFERED' AND job_id != $2
    `, [usns, jobId]);
    const competingSet = new Set((competingOffers as { student_usn: string }[]).map(r => r.student_usn));

    const candidateList = (shortlisted as Record<string, unknown>[]).map((c, i) => {
      const hasCompeting = competingSet.has(String(c['student_id']));
      return `${i + 1}. USN=${sanitize(c['student_id'])} cgpa=${c['cgpa']} score=${c['readiness_score'] ?? 'N/A'} competingOffer=${hasCompeting}`;
    }).join('\n');

    const prompt = `Predict offer acceptance and joining probabilities for these shortlisted candidates for:
Role: ${sanitize(job['title'])}
CTC: ₹${job['ctc_lpa']} LPA
Role Type: ${sanitize(job['role_type'])}
Location: ${sanitize(job['location'])}

Candidates (competingOffer=true means they have another offer):
${candidateList}

Return JSON array: [{"usn":"...","acceptProbability":75,"joiningProbability":60,"declineRisk":"LOW|MEDIUM|HIGH","declineReason":"...","suggestedCTC":12}]
suggestedCTC is the CTC in LPA to maximize acceptance. Return ONLY the JSON array, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch (err) {
      this.logger.warn('Offer prediction failed', err);
      return (shortlisted as Record<string, unknown>[]).map(c => ({
        usn: c['student_id'],
        acceptProbability: 70,
        joiningProbability: 60,
        declineRisk: competingSet.has(String(c['student_id'])) ? 'HIGH' : 'LOW',
        declineReason: competingSet.has(String(c['student_id'])) ? 'Has competing offer' : null,
        suggestedCTC: job['ctc_lpa'],
      }));
    }
  }

  // ── AI: Outreach generator ────────────────────────────────────────────────

  async aiOutreach(recruiterId: string, params: {
    jobId: string;
    candidates: Record<string, unknown>[];
    channel: string;
  }): Promise<unknown[]> {
    if (!params.candidates.length) return [];

    const jobs = await this.ds.query(`SELECT * FROM recruiter_jobs WHERE id = $1`, [params.jobId]);
    const job = jobs[0] as Record<string, unknown> | undefined;
    if (!job) return [];

    const channelLimits: Record<string, number> = { WHATSAPP: 1000, LINKEDIN: 300, EMAIL: 5000 };
    const limit = channelLimits[params.channel] ?? 5000;

    const results: unknown[] = [];
    for (const candidate of params.candidates.slice(0, 10)) {
      const prompt = `Write a personalized ${sanitize(params.channel)} recruitment message for this candidate.

Candidate: ${sanitize(candidate['name'])} | Dept: ${sanitize(candidate['department'])} | CGPA: ${candidate['cgpa']} | Skills: ${sanitize(JSON.stringify(candidate['skills']))}
Role: ${sanitize(job['title'])} at ${sanitize(job['location'])} | ₹${job['ctc_lpa']} LPA | Deadline: ${sanitize(String(job['apply_deadline']))}

${params.channel === 'EMAIL' ? 'Include a subject line.' : ''}
Keep it ${limit <= 300 ? 'very brief (under 250 chars)' : limit <= 1000 ? 'concise (under 800 chars)' : 'professional and detailed'}.
Reference their specific skills that match the role. Be warm and specific.

Return JSON: {"subject":"...email subject if EMAIL channel else null","body":"the message text"}
Return ONLY the JSON, no markdown.`;

      try {
        const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
        const parsed = JSON.parse(text.replace(/^```json\n?|```$/g, '')) as { subject?: string; body: string };
        results.push({
          candidateUsn: candidate['studentId'] ?? candidate['student_id'] ?? candidate['usn'],
          candidateName: candidate['name'],
          channel: params.channel,
          subject: parsed.subject ?? undefined,
          body: parsed.body,
          characterCount: parsed.body.length,
        });
      } catch {
        results.push({
          candidateUsn: candidate['studentId'] ?? candidate['student_id'],
          candidateName: candidate['name'],
          channel: params.channel,
          body: `Hi ${sanitize(candidate['name'])}, we'd love to consider you for ${sanitize(job['title'])} at ₹${job['ctc_lpa']} LPA. Please apply by ${sanitize(String(job['apply_deadline']))}.`,
          characterCount: 120,
        });
      }
    }
    return results;
  }

  // ── AI: Bias audit ────────────────────────────────────────────────────────

  async aiBiasAudit(shortlistedUsns: string[], allApplicantUsns: string[], institutionId: string): Promise<unknown> {
    if (!shortlistedUsns.length || !allApplicantUsns.length) {
      return { genderBreakdown: [], collegeTierBreakdown: [], regionBreakdown: [], flags: [], overallBiasScore: 0 };
    }

    // Fix 2: verify all USNs belong to the recruiter's institution before fetching
    const allUsns = [...new Set([...shortlistedUsns, ...allApplicantUsns])];
    const owned = await this.ds.query(
      `SELECT student_id FROM students WHERE student_id = ANY($1::text[]) AND institution_id = $2`,
      [allUsns, institutionId],
    );
    const ownedSet = new Set((owned as { student_id: string }[]).map(r => r.student_id));
    const safe = (usns: string[]) => usns.filter(u => ownedSet.has(u));
    const safeShortlisted = safe(shortlistedUsns);
    const safeAll = safe(allApplicantUsns);
    if (!safeShortlisted.length || !safeAll.length) {
      return { genderBreakdown: [], collegeTierBreakdown: [], regionBreakdown: [], flags: ['No authorized candidates in the provided lists'], overallBiasScore: 0 };
    }

    const [shortlisted, allApplicants] = await Promise.all([
      this.ds.query(`SELECT student_id, name, department, cgpa FROM students WHERE student_id = ANY($1::text[]) AND institution_id = $2`, [safeShortlisted, institutionId]),
      this.ds.query(`SELECT student_id, name, department, cgpa FROM students WHERE student_id = ANY($1::text[]) AND institution_id = $2`, [safeAll, institutionId]),
    ]);

    const shortlistSummary = (shortlisted as Record<string, unknown>[]).map(c =>
      `USN=${sanitize(c['student_id'])} dept=${sanitize(c['department'])} cgpa=${c['cgpa']}`
    ).join(', ');
    const poolSummary = (allApplicants as Record<string, unknown>[]).map(c =>
      `USN=${sanitize(c['student_id'])} dept=${sanitize(c['department'])} cgpa=${c['cgpa']}`
    ).join(', ');

    const prompt = `Analyze potential bias in this shortlisting decision for an Indian engineering college placement.

Shortlisted (${shortlisted.length}): ${shortlistSummary}
Full applicant pool (${allApplicants.length}): ${poolSummary}

Return JSON: {
  "genderBreakdown":[{"label":"Male","shortlistPct":80,"poolPct":65}],
  "collegeTierBreakdown":[{"tier":"CSE/ISE","shortlistPct":90,"poolPct":60}],
  "regionBreakdown":[{"region":"Karnataka","shortlistPct":100,"poolPct":85}],
  "flags":["flag1","flag2"],
  "overallBiasScore":35
}
overallBiasScore: 0-100, higher = more biased. flags = specific concerns. Return ONLY the JSON, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      return JSON.parse(text.replace(/^```json\n?|```$/g, ''));
    } catch (err) {
      this.logger.warn('Bias audit failed', err);
      return {
        genderBreakdown: [{ label: 'All candidates', shortlistPct: 100, poolPct: 100 }],
        collegeTierBreakdown: [],
        regionBreakdown: [],
        flags: ['AI audit unavailable'],
        overallBiasScore: 0,
      };
    }
  }

  // ── AI: Diversity nudge ───────────────────────────────────────────────────

  async aiDiversityNudge(jobId: string, recruiterId: string, currentShortlist: string[], institutionId: string): Promise<{ reorderedUsns: string[] }> {
    if (!currentShortlist.length) return { reorderedUsns: [] };
    const job = await this.getJob(jobId, recruiterId) as Record<string, unknown>;

    const candidates = await this.ds.query(`
      SELECT student_id, name, department, cgpa, skills
      FROM students WHERE student_id = ANY($1::text[]) AND institution_id = $2
    `, [currentShortlist, institutionId]);

    const candidateList = (candidates as Record<string, unknown>[]).map((c, i) =>
      `${i + 1}. USN=${sanitize(c['student_id'])} dept=${sanitize(c['department'])} cgpa=${c['cgpa']}`
    ).join('\n');

    const prompt = `Reorder this shortlist to improve diversity without dropping candidates below the CGPA threshold of ${job['min_cgpa']}.

Shortlisted candidates:
${candidateList}

Return JSON: {"reorderedUsns":["1RV21CS004","1RV21CS001",...]} — same USNs, different order.
Prioritize department diversity and avoid over-representation of any single branch.
Return ONLY the JSON, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      const parsed = JSON.parse(text.replace(/^```json\n?|```$/g, '')) as { reorderedUsns: string[] };
      return parsed;
    } catch (err) {
      this.logger.warn('Diversity nudge failed', err);
      return { reorderedUsns: currentShortlist };
    }
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getAnalytics(recruiterId: string): Promise<unknown> {
    const statusCounts = await this.ds.query(`
      SELECT ja.status, COUNT(*)::int as count
      FROM recruiter_applications ja
      JOIN recruiter_jobs rj ON rj.id = ja.job_id
      WHERE rj.recruiter_id = $1
      GROUP BY ja.status
    `, [recruiterId]);

    const jobSkills = await this.ds.query(`
      SELECT required_skills FROM recruiter_jobs WHERE recruiter_id = $1
    `, [recruiterId]);

    const counts: Record<string, number> = {};
    for (const row of statusCounts as { status: string; count: number }[]) {
      counts[row.status] = row.count;
    }

    const totalApplied = Object.values(counts).reduce((a, b) => a + b, 0);
    const shortlisted = counts['SHORTLISTED'] ?? 0;
    const interview = counts['INTERVIEW'] ?? 0;
    const offered = counts['OFFERED'] ?? 0;

    const funnel = [
      { stage: 'Applied', count: totalApplied, conversionRate: 100 },
      { stage: 'Shortlisted', count: shortlisted, conversionRate: totalApplied ? Math.round(shortlisted * 100 / totalApplied) : 0 },
      { stage: 'Interview', count: interview, conversionRate: shortlisted ? Math.round(interview * 100 / shortlisted) : 0 },
      { stage: 'Offered', count: offered, conversionRate: interview ? Math.round(offered * 100 / interview) : 0 },
    ];

    // Aggregate skills demand
    const skillFreq: Record<string, number> = {};
    for (const row of jobSkills as { required_skills: string[] }[]) {
      for (const skill of row.required_skills ?? []) {
        skillFreq[skill] = (skillFreq[skill] ?? 0) + 1;
      }
    }
    const skillDemand = Object.entries(skillFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([skill, demand]) => ({
        skill,
        demand: Math.min(demand * 20, 100),
        supply: Math.max(10, 100 - demand * 15),
        scarcityScore: Math.max(0, demand * 15 - 10),
      }));

    // Source ROI (single institution — RVCE)
    const sourceRoi = [
      { college: 'RVCE', hires: offered, qualityScore: 82, costPerHire: 45000 },
    ];

    // AI insights
    let aiInsights: string[] = [
      `${totalApplied} total applications across your ${(jobSkills as unknown[]).length} active jobs.`,
      offered > 0 ? `${offered} offer(s) made — monitor acceptance rate closely.` : 'No offers extended yet — shortlist high-fit candidates next.',
    ];

    if (totalApplied > 0) {
      try {
            const prompt = `Generate 3 concise, actionable hiring insights for a campus recruiter in India.
Funnel data: ${totalApplied} applied, ${shortlisted} shortlisted, ${interview} in interview, ${offered} offered.
Top required skills: ${Object.keys(skillFreq).slice(0, 5).join(', ')}.
Return JSON array of 3 strings: ["insight1","insight2","insight3"]
Return ONLY the JSON array, no markdown.`;
        const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
        aiInsights = JSON.parse(text.replace(/^```json\n?|```$/g, ''));
      } catch {
        // keep default insights
      }
    }

    return { funnel, sourceRoi, skillDemand, aiInsights, period: 'Current Placement Season' };
  }

  // ── Recruiter NL query ────────────────────────────────────────────────────

  async recruiterNlQuery(recruiterId: string, query: string): Promise<{ answer: string; table?: Record<string, unknown>[] }> {
    const analytics = await this.getAnalytics(recruiterId) as Record<string, unknown>;

    const prompt = `A recruiter is asking: "${sanitize(query)}"

Here is their current hiring data:
${JSON.stringify(analytics, null, 2).slice(0, 3000)}

Answer the question in plain English (1-3 sentences). If the answer can be shown as a table, include it.
Return JSON: {"answer":"...","table":[{"Column":"Value"}]|null}
Return ONLY the JSON, no markdown.`;

    try {
      const text = (await claudeGenerate(prompt, CLAUDE_FAST)).trim();
      const parsed = JSON.parse(text.replace(/^```json\n?|```$/g, '')) as { answer: string; table?: Record<string, unknown>[] };
      return { answer: parsed.answer, table: parsed.table ?? undefined };
    } catch (err) {
      this.logger.warn('NL query failed', err);
      return { answer: 'Unable to process your query at this time. Please try rephrasing.' };
    }
  }
}
