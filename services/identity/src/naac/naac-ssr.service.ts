import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { NaacService, CriterionResult } from './naac.service';

// ─── NAAC Criterion context for prompt grounding ─────────────────────────────

const CRITERION_NAAC_DESCRIPTIONS: Record<string, string> = {
  C1: `Criterion 1 – Curricular Aspects evaluates the institution's curriculum design, adoption of Choice Based Credit System (CBCS), elective offerings, value-added courses, academic flexibility, and alignment with national policies such as NEP 2020. NAAC assessors look for evidence of structured teaching plans, course completion records, and stakeholder feedback on curriculum relevance.`,

  C2: `Criterion 2 – Teaching-Learning and Evaluation assesses student enrolment, catering to student diversity, teaching-learning strategies, teacher quality (qualifications, experience, PhD holders), ICT-enabled learning, internal assessment transparency, pass percentages, and student performance in university examinations. The student-teacher ratio is a key quantitative benchmark.`,

  C3: `Criterion 3 – Research, Innovations and Extension covers faculty research output (publications, patents, funded projects), PhD guidance, research grants from DST/DBT/AICTE, innovation ecosystem (incubation, startups), and extension/outreach activities. NAAC rewards institutions with structured research policies, dedicated R&D budget, and community engagement programs.`,

  C4: `Criterion 4 – Infrastructure and Learning Resources examines physical infrastructure (classrooms, labs, sports), IT infrastructure (computing, internet, e-resources), library holdings (books, journals, Shodhganga), and specialized facilities for differently-abled students. Maintenance budgets and utilisation rates matter significantly.`,

  C5: `Criterion 5 – Student Support and Progression focuses on student scholarships, career counseling, placement statistics, higher education progression, entrepreneurship support, alumni engagement, anti-ragging measures, and student grievance redressal. Placement percentage and scholarship reach directly impact scores.`,

  C6: `Criterion 6 – Governance, Leadership and Management evaluates institutional vision implementation, strategic planning, decentralized governance (IQAC effectiveness), staff welfare, financial management, e-governance adoption, resource mobilization, and audit compliance. NAAC values institutions where technology genuinely drives administrative efficiency.`,

  C7: `Criterion 7 – Institutional Values and Best Practices assesses gender equity measures, environmental sustainability (green campus, energy audits), inclusivity, constitutional values, best practices unique to the institution, and its distinctive contribution to higher education. Two best practices must be documented in detail.`,
};

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class NaacSsrService {
  private readonly logger = new Logger(NaacSsrService.name);
  private readonly anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] ?? '' });

  constructor(
    @Optional() @InjectDataSource() private readonly db: DataSource | null,
    private readonly naacService: NaacService,
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async generateCriterionParagraph(criterionId: string): Promise<{
    criterionId: string;
    criterionName: string;
    paragraph: string;
    generatedAt: string;
    tokenCount?: number;
  }> {
    const dashboard = await this.naacService.getDashboard();
    const criterion = dashboard.criteria.find(c => c.id === criterionId);

    if (!criterion) {
      return {
        criterionId,
        criterionName: 'Unknown',
        paragraph: `No data found for criterion ${criterionId}.`,
        generatedAt: new Date().toISOString(),
      };
    }

    const paragraph = await this.callClaude(
      criterion,
      dashboard.institution.name,
      dashboard.institution.affiliation,
    );

    return {
      criterionId,
      criterionName: criterion.name,
      paragraph,
      generatedAt: new Date().toISOString(),
    };
  }

  async generateFullSsr(): Promise<{
    institutionName: string;
    predictedCgpa: number;
    predictedGrade: string;
    generatedAt: string;
    sections: Array<{
      criterionId: string;
      criterionName: string;
      paragraph: string;
    }>;
  }> {
    const dashboard = await this.naacService.getDashboard();

    // Generate paragraphs sequentially to avoid rate limits
    const sections: Array<{ criterionId: string; criterionName: string; paragraph: string }> = [];
    for (const criterion of dashboard.criteria) {
      const paragraph = await this.callClaude(
        criterion,
        dashboard.institution.name,
        dashboard.institution.affiliation,
      );
      sections.push({
        criterionId: criterion.id,
        criterionName: criterion.name,
        paragraph,
      });
    }

    return {
      institutionName: dashboard.institution.name,
      predictedCgpa: dashboard.predictedCgpa,
      predictedGrade: dashboard.predictedGrade,
      generatedAt: new Date().toISOString(),
      sections,
    };
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private buildPrompt(
    criterion: CriterionResult,
    institutionName: string,
    affiliation: string,
  ): string {
    const naacContext = CRITERION_NAAC_DESCRIPTIONS[criterion.id] ?? '';

    const metricsJson = criterion.metrics
      .map(m => {
        const lines: string[] = [
          `  Metric ${m.id}: ${m.name}`,
          `    Max Score: ${m.maxScore} | Earned: ${m.earnedScore ?? 'pending manual entry'} | Source: ${m.dataSource}`,
        ];
        if (m.liveData) {
          lines.push(`    Live Data: ${JSON.stringify(m.liveData)}`);
        }
        if (m.edaiNote) {
          lines.push(`    Note: ${m.edaiNote}`);
        }
        return lines.join('\n');
      })
      .join('\n\n');

    return `You are an expert NAAC SSR (Self Study Report) writer for Indian higher education institutions.

Institution: ${institutionName}
Affiliation: ${affiliation}

NAAC Context for ${criterion.id} – ${criterion.name}:
${naacContext}

Live Institutional Data:
${metricsJson}

Criterion Score: ${criterion.earnedScore} / ${criterion.maxScore} (${criterion.weightedScore} weighted points out of ${criterion.weightage})

Task: Write a formal 200–300 word narrative paragraph for the NAAC SSR under ${criterion.id} – ${criterion.name}.

Requirements:
- Write in formal academic prose suitable for submission to NAAC assessors
- Cite specific numbers from the live data provided (do not fabricate figures)
- Where data source is "manual" and no live figure is available, use institutional language such as "the institution maintains..." without inventing numbers
- Align language to NAAC assessment descriptors and quality indicators
- Reference VTU affiliation and relevant national policies (NEP 2020, AICTE guidelines) where appropriate
- Do NOT include bullet points, headers, or markdown — plain flowing paragraphs only
- End with a forward-looking sentence about institutional commitment

Return ONLY the paragraph text. No preamble, no labels.`;
  }

  private async callClaude(
    criterion: CriterionResult,
    institutionName: string,
    affiliation: string,
  ): Promise<string> {
    const prompt = this.buildPrompt(criterion, institutionName, affiliation);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
      return text || this.fallbackParagraph(criterion);
    } catch (err) {
      this.logger.warn(
        `[NAAC-SSR] Claude call failed for ${criterion.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.fallbackParagraph(criterion);
    }
  }

  private fallbackParagraph(criterion: CriterionResult): string {
    return (
      `${criterion.name} represents a key pillar of institutional quality at ${criterion.id}. ` +
      `The institution has scored ${criterion.earnedScore} out of a maximum ${criterion.maxScore} points ` +
      `under this criterion, reflecting its ongoing commitment to academic excellence and compliance ` +
      `with NAAC quality indicators. Detailed evidence is maintained in the institutional records ` +
      `and is available for verification by the peer team during the institutional visit.`
    );
  }
}
