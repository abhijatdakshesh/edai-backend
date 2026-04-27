import { Injectable } from '@nestjs/common';

// ─── Input types for each supported criterion ────────────────────────────────

export interface Criterion2Input {
  /** Total enrolled students */
  totalStudents: number;
  /** Total full-time faculty */
  totalFaculty: number;
  /** Average attendance percentage (0-100) */
  averageAttendancePct: number;
  /** % of faculty with PhD */
  facultyWithPhDPct: number;
  /** % of syllabus covered on average */
  syllabusCoveragePct: number;
  /** Pass percentage last semester */
  passPercentage: number;
}

export interface Criterion3Input {
  /** Number of peer-reviewed publications in the academic year */
  peerReviewedPublications: number;
  /** Number of funded research projects */
  fundedProjects: number;
  /** Total faculty count (used for per-faculty normalization) */
  totalFaculty: number;
  /** Number of patents filed */
  patentsFiled: number;
  /** Total research funding received (INR lakhs) */
  researchFundingLakhs: number;
}

export interface SubCriterionScore {
  subCriterion: string;
  label: string;
  score: number;
  maxScore: number;
  pct: number;
  rationale: string;
}

export interface CriterionScoreResult {
  criterion: number;
  label: string;
  subScores: SubCriterionScore[];
  totalScore: number;
  maxScore: number;
  pct: number;
  disclaimer: string;
}

// ─── Criterion weights (NAAC 3rd cycle revised framework) ────────────────────
// Source: NAAC Revised Accreditation Framework 2022, Annexure II
// These are ESTIMATES based on public framework docs — always label as such.

const C2_MAX = 350; // Criterion II weightage
const C3_MAX = 120; // Criterion III weightage

@Injectable()
export class NaacCriterionCalculatorService {

  computeCriterion2(input: Criterion2Input): CriterionScoreResult {
    const subScores: SubCriterionScore[] = [];

    // 2.1 — Student Enrolment and Profile (max 30)
    subScores.push(this.score21_studentTeacherRatio(input.totalStudents, input.totalFaculty));

    // 2.2 — Catering to Student Diversity (max 40)
    subScores.push(this.score22_attendanceAndSupport(input.averageAttendancePct));

    // 2.3 — Teaching-Learning Process (max 60)
    subScores.push(this.score23_teachingProcess(input.syllabusCoveragePct));

    // 2.4 — Teacher Profile and Quality (max 70)
    subScores.push(this.score24_facultyQuality(input.facultyWithPhDPct));

    // 2.6 — Student Performance and Learning Outcomes (max 40)
    subScores.push(this.score26_studentOutcomes(input.passPercentage));

    const totalScore = subScores.reduce((s, sc) => s + sc.score, 0);
    // maxScore = only the sub-criteria EdAI can compute (not full NAAC C2 weight of 350)
    const computedMax = subScores.reduce((s, sc) => s + sc.maxScore, 0);
    return {
      criterion: 2,
      label: 'Teaching-Learning and Evaluation',
      subScores,
      totalScore: Math.round(totalScore * 100) / 100,
      maxScore: computedMax,
      pct: Math.round((totalScore / computedMax) * 10000) / 100,
      disclaimer: 'EdAI estimate only — NAAC peer team score may differ. Manual override required for DVV submission.',
    };
  }

  computeCriterion3(input: Criterion3Input): CriterionScoreResult {
    const subScores: SubCriterionScore[] = [];

    // 3.2 — Resource Mobilization for Research (max 30)
    const sc32 = this.score32_researchFunding(input.researchFundingLakhs, input.fundedProjects);
    subScores.push(sc32);

    // 3.3 — Innovation Ecosystem (max 30)
    const sc33 = this.score33_publications(input.peerReviewedPublications, input.totalFaculty);
    subScores.push(sc33);

    // 3.4 — Research Publications and Awards (max 40)
    const sc34 = this.score34_publicationsAndPatents(input.peerReviewedPublications, input.patentsFiled, input.totalFaculty);
    subScores.push(sc34);

    const totalScore = subScores.reduce((s, sc) => s + sc.score, 0);
    const computedMax = subScores.reduce((s, sc) => s + sc.maxScore, 0);
    return {
      criterion: 3,
      label: 'Research, Innovations and Extension',
      subScores,
      totalScore: Math.round(totalScore * 100) / 100,
      maxScore: computedMax,
      pct: Math.round((totalScore / computedMax) * 10000) / 100,
      disclaimer: 'EdAI estimate only — NAAC peer team score may differ. Manual override required for DVV submission.',
    };
  }

  // ─── Private sub-criterion scorers ────────────────────────────────────────

  private score21_studentTeacherRatio(students: number, faculty: number): SubCriterionScore {
    const MAX = 30;
    const ratio = faculty > 0 ? students / faculty : 999;
    // NAAC benchmark: ≤15:1 = full marks; 15-20 = 70%; 20-30 = 40%; >30 = 0
    const pct = ratio <= 15 ? 1 : ratio <= 20 ? 0.7 : ratio <= 30 ? 0.4 : 0;
    const score = MAX * pct;
    return {
      subCriterion: '2.1',
      label: 'Student-Teacher Ratio',
      score: Math.round(score * 100) / 100,
      maxScore: MAX,
      pct: Math.round(pct * 100),
      rationale: `Ratio ${ratio.toFixed(1)}:1 → ${Math.round(pct * 100)}% of max`,
    };
  }

  private score22_attendanceAndSupport(avgAttendance: number): SubCriterionScore {
    const MAX = 40;
    // ≥85% = 100%, 75-85 = 70%, 65-75 = 40%, <65 = 10%
    const pct = avgAttendance >= 85 ? 1 : avgAttendance >= 75 ? 0.7 : avgAttendance >= 65 ? 0.4 : 0.1;
    const score = MAX * pct;
    return {
      subCriterion: '2.2',
      label: 'Average Attendance',
      score: Math.round(score * 100) / 100,
      maxScore: MAX,
      pct: Math.round(pct * 100),
      rationale: `Avg attendance ${avgAttendance.toFixed(1)}% → ${Math.round(pct * 100)}% of max`,
    };
  }

  private score23_teachingProcess(syllabusCoverage: number): SubCriterionScore {
    const MAX = 60;
    const pct = syllabusCoverage >= 90 ? 1 : syllabusCoverage >= 75 ? 0.75 : syllabusCoverage >= 60 ? 0.5 : 0.25;
    const score = MAX * pct;
    return {
      subCriterion: '2.3',
      label: 'Syllabus Coverage',
      score: Math.round(score * 100) / 100,
      maxScore: MAX,
      pct: Math.round(pct * 100),
      rationale: `Syllabus coverage ${syllabusCoverage.toFixed(1)}% → ${Math.round(pct * 100)}% of max`,
    };
  }

  private score24_facultyQuality(phdPct: number): SubCriterionScore {
    const MAX = 70;
    // ≥60% PhD = 100%, 40-60 = 70%, 20-40 = 40%, <20 = 15%
    const pct = phdPct >= 60 ? 1 : phdPct >= 40 ? 0.7 : phdPct >= 20 ? 0.4 : 0.15;
    const score = MAX * pct;
    return {
      subCriterion: '2.4',
      label: 'Faculty with PhD (%)',
      score: Math.round(score * 100) / 100,
      maxScore: MAX,
      pct: Math.round(pct * 100),
      rationale: `${phdPct.toFixed(1)}% faculty with PhD → ${Math.round(pct * 100)}% of max`,
    };
  }

  private score26_studentOutcomes(passPct: number): SubCriterionScore {
    const MAX = 40;
    const pct = passPct >= 90 ? 1 : passPct >= 75 ? 0.75 : passPct >= 60 ? 0.5 : 0.25;
    const score = MAX * pct;
    return {
      subCriterion: '2.6',
      label: 'Pass Percentage',
      score: Math.round(score * 100) / 100,
      maxScore: MAX,
      pct: Math.round(pct * 100),
      rationale: `Pass rate ${passPct.toFixed(1)}% → ${Math.round(pct * 100)}% of max`,
    };
  }

  private score32_researchFunding(fundingLakhs: number, projects: number): SubCriterionScore {
    const MAX = 30;
    // ≥10 projects or ≥50L = 100%, ≥5 or ≥20L = 60%, ≥2 or ≥5L = 30%, else 0
    const byProjects = projects >= 10 ? 1 : projects >= 5 ? 0.6 : projects >= 2 ? 0.3 : 0;
    const byFunding = fundingLakhs >= 50 ? 1 : fundingLakhs >= 20 ? 0.6 : fundingLakhs >= 5 ? 0.3 : 0;
    const pct = Math.max(byProjects, byFunding);
    const score = MAX * pct;
    return {
      subCriterion: '3.2',
      label: 'Research Funding',
      score: Math.round(score * 100) / 100,
      maxScore: MAX,
      pct: Math.round(pct * 100),
      rationale: `${projects} projects, ₹${fundingLakhs}L funding → ${Math.round(pct * 100)}% of max`,
    };
  }

  private score33_publications(publications: number, faculty: number): SubCriterionScore {
    const MAX = 30;
    const perFaculty = faculty > 0 ? publications / faculty : 0;
    // per-faculty publication rate: ≥2 = 100%, ≥1 = 70%, ≥0.5 = 40%, else 10%
    const pct = perFaculty >= 2 ? 1 : perFaculty >= 1 ? 0.7 : perFaculty >= 0.5 ? 0.4 : 0.1;
    const score = MAX * pct;
    return {
      subCriterion: '3.3',
      label: 'Publications per Faculty',
      score: Math.round(score * 100) / 100,
      maxScore: MAX,
      pct: Math.round(pct * 100),
      rationale: `${perFaculty.toFixed(2)} publications/faculty → ${Math.round(pct * 100)}% of max`,
    };
  }

  private score34_publicationsAndPatents(publications: number, patents: number, faculty: number): SubCriterionScore {
    const MAX = 40;
    const perFaculty = faculty > 0 ? publications / faculty : 0;
    const pubPct = perFaculty >= 3 ? 0.7 : perFaculty >= 1.5 ? 0.5 : perFaculty >= 0.5 ? 0.3 : 0.1;
    const patentPct = patents >= 5 ? 0.3 : patents >= 2 ? 0.2 : patents >= 1 ? 0.1 : 0;
    const score = MAX * (pubPct + patentPct);
    return {
      subCriterion: '3.4',
      label: 'Publications and Patents',
      score: Math.min(MAX, Math.round(score * 100) / 100),
      maxScore: MAX,
      pct: Math.min(100, Math.round((pubPct + patentPct) * 100)),
      rationale: `${publications} publications, ${patents} patents → ${Math.min(100, Math.round((pubPct + patentPct) * 100))}% of max`,
    };
  }
}
