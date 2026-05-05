import { Injectable } from '@nestjs/common';

// ─── Input types for each supported criterion ────────────────────────────────

export interface Criterion1Input {
  /** % of programmes reviewed by Board of Studies in last 3 years */
  boardStudyProgrammesPct: number;
  /** % of elective credits offered (NEP 2020 / CBCS alignment) */
  electiveCreditsPct: number;
  /** Number of value-added courses offered with certification */
  valueAddedCoursesCount: number;
  /** Feedback mechanism score (0–100): students, faculty, alumni, employers */
  feedbackSystemScore: number;
}

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

export interface Criterion4Input {
  /** % of classrooms with ICT (smart boards, projectors) */
  classroomsWithICTPct: number;
  /** Total library books (physical + e-resources count) */
  libraryResourcesCount: number;
  /** Internet bandwidth per student (Mbps / total students * 100 for index) */
  internetBandwidthMbps: number;
  /** Total students (for bandwidth-per-student calc) */
  totalStudents: number;
  /** % of budget allocated to maintenance of infrastructure */
  maintenanceBudgetPct: number;
}

export interface Criterion5Input {
  /** % of students receiving scholarships or financial aid */
  scholarshipStudentsPct: number;
  /** % of eligible students placed in the last academic year */
  placementPct: number;
  /** % of graduates progressing to higher studies */
  higherStudiesPct: number;
  /** Number of state/national/international sports/cultural wins */
  studentAchievementsCount: number;
  /** Alumni contribution to institution (INR lakhs) */
  alumniContributionsLakhs: number;
}

export interface Criterion6Input {
  /** Strategic plan documented and implemented (0–100 compliance score) */
  strategicPlanScore: number;
  /** IQAC functional with e-gov integration (0–100) */
  iqacFunctionalityScore: number;
  /** Number of faculty awards/recognitions in last 3 years */
  facultyAwardCount: number;
  /** % of administrative processes digitalised (e-governance) */
  eGovernancePct: number;
  /** Internal audit compliance percentage */
  auditCompliancePct: number;
}

export interface Criterion7Input {
  /** Number of green campus / environmental sustainability initiatives */
  greenInitiativesCount: number;
  /** Number of gender equity / inclusive practices programmes */
  genderEquityProgramsCount: number;
  /** Number of documented best practices submitted to NAAC */
  bestPracticesCount: number;
  /** Institutional distinctiveness score (committee evaluation, 0–100) */
  distinctivenessScore: number;
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

const C1_MAX = 150;  // Criterion I  — Curricular Aspects          (sub-scores: 40+40+40+30=150)
const C2_MAX = 240;  // Criterion II — Teaching-Learning             (sub-scores: 30+40+60+70+40=240; official NAAC weight is 350 — sub-criteria below are estimates pending full RAF mapping)
const C3_MAX = 100;  // Criterion III — Research, Innovations        (sub-scores: 30+30+40=100)
const C4_MAX = 100;  // Criterion IV — Infrastructure                (sub-scores: 30+30+25+15=100)
const C5_MAX = 130;  // Criterion V  — Student Support               (sub-scores: 30+40+20+20+20=130)
const C6_MAX = 100;  // Criterion VI — Governance                    (sub-scores: 20+30+20+20+10=100)
const C7_MAX = 50;   // Criterion VII — Institutional Values         (sub-scores: 15+10+15+10=50)

export const CRITERION_MAX_SCORES: Record<number, number> = {
  1: C1_MAX,
  2: C2_MAX,
  3: C3_MAX,
  4: C4_MAX,
  5: C5_MAX,
  6: C6_MAX,
  7: C7_MAX,
};

const DISCLAIMER = 'EdAI estimate only — NAAC peer team score may differ. Manual override required for DVV submission.';

@Injectable()
export class NaacCriterionCalculatorService {

  // ─── Criterion I — Curricular Aspects ─────────────────────────────────────

  computeCriterion1(input: Criterion1Input): CriterionScoreResult {
    const subScores: SubCriterionScore[] = [
      this.score11_curriculumDesign(input.boardStudyProgrammesPct),
      this.score12_academicFlexibility(input.electiveCreditsPct),
      this.score13_curriculumEnrichment(input.valueAddedCoursesCount),
      this.score14_feedbackSystem(input.feedbackSystemScore),
    ];
    return this.buildResult(1, 'Curricular Aspects', subScores);
  }

  private score11_curriculumDesign(pct: number): SubCriterionScore {
    const MAX = 40;
    const f = pct >= 100 ? 1 : pct >= 75 ? 0.75 : pct >= 50 ? 0.5 : 0.25;
    return this.sub('1.1', 'Board of Studies Review', MAX, f,
      `${pct.toFixed(0)}% programmes reviewed`);
  }

  private score12_academicFlexibility(electivePct: number): SubCriterionScore {
    const MAX = 40;
    // CBCS/NEP: ≥30% elective credits = excellent
    const f = electivePct >= 30 ? 1 : electivePct >= 20 ? 0.7 : electivePct >= 10 ? 0.4 : 0.15;
    return this.sub('1.2', 'Academic Flexibility (Electives)', MAX, f,
      `${electivePct.toFixed(0)}% elective credit share`);
  }

  private score13_curriculumEnrichment(courses: number): SubCriterionScore {
    const MAX = 40;
    const f = courses >= 10 ? 1 : courses >= 6 ? 0.75 : courses >= 3 ? 0.5 : courses >= 1 ? 0.25 : 0;
    return this.sub('1.3', 'Value-Added Courses', MAX, f,
      `${courses} certified value-added courses`);
  }

  private score14_feedbackSystem(score: number): SubCriterionScore {
    const MAX = 30;
    const f = score >= 80 ? 1 : score >= 60 ? 0.7 : score >= 40 ? 0.4 : 0.1;
    return this.sub('1.4', 'Feedback Mechanism', MAX, f,
      `Feedback system score ${score.toFixed(0)}/100`);
  }

  // ─── Criterion II — Teaching-Learning and Evaluation ──────────────────────

  computeCriterion2(input: Criterion2Input): CriterionScoreResult {
    const subScores: SubCriterionScore[] = [
      this.score21_studentTeacherRatio(input.totalStudents, input.totalFaculty),
      this.score22_attendanceAndSupport(input.averageAttendancePct),
      this.score23_teachingProcess(input.syllabusCoveragePct),
      this.score24_facultyQuality(input.facultyWithPhDPct),
      this.score26_studentOutcomes(input.passPercentage),
    ];
    return this.buildResult(2, 'Teaching-Learning and Evaluation', subScores);
  }

  private score21_studentTeacherRatio(students: number, faculty: number): SubCriterionScore {
    const MAX = 30;
    const ratio = faculty > 0 ? students / faculty : 999;
    const f = ratio <= 15 ? 1 : ratio <= 20 ? 0.7 : ratio <= 30 ? 0.4 : 0;
    return this.sub('2.1', 'Student-Teacher Ratio', MAX, f,
      `Ratio ${ratio.toFixed(1)}:1`);
  }

  private score22_attendanceAndSupport(avgAttendance: number): SubCriterionScore {
    const MAX = 40;
    const f = avgAttendance >= 85 ? 1 : avgAttendance >= 75 ? 0.7 : avgAttendance >= 65 ? 0.4 : 0.1;
    return this.sub('2.2', 'Average Attendance', MAX, f,
      `Avg attendance ${avgAttendance.toFixed(1)}%`);
  }

  private score23_teachingProcess(syllabusCoverage: number): SubCriterionScore {
    const MAX = 60;
    const f = syllabusCoverage >= 90 ? 1 : syllabusCoverage >= 75 ? 0.75 : syllabusCoverage >= 60 ? 0.5 : 0.25;
    return this.sub('2.3', 'Syllabus Coverage', MAX, f,
      `${syllabusCoverage.toFixed(1)}% syllabus covered`);
  }

  private score24_facultyQuality(phdPct: number): SubCriterionScore {
    const MAX = 70;
    const f = phdPct >= 60 ? 1 : phdPct >= 40 ? 0.7 : phdPct >= 20 ? 0.4 : 0.15;
    return this.sub('2.4', 'Faculty with PhD (%)', MAX, f,
      `${phdPct.toFixed(1)}% faculty with PhD`);
  }

  private score26_studentOutcomes(passPct: number): SubCriterionScore {
    const MAX = 40;
    const f = passPct >= 90 ? 1 : passPct >= 75 ? 0.75 : passPct >= 60 ? 0.5 : 0.25;
    return this.sub('2.6', 'Pass Percentage', MAX, f,
      `Pass rate ${passPct.toFixed(1)}%`);
  }

  // ─── Criterion III — Research, Innovations and Extension ──────────────────

  computeCriterion3(input: Criterion3Input): CriterionScoreResult {
    const subScores: SubCriterionScore[] = [
      this.score32_researchFunding(input.researchFundingLakhs, input.fundedProjects),
      this.score33_publications(input.peerReviewedPublications, input.totalFaculty),
      this.score34_publicationsAndPatents(input.peerReviewedPublications, input.patentsFiled, input.totalFaculty),
    ];
    return this.buildResult(3, 'Research, Innovations and Extension', subScores);
  }

  private score32_researchFunding(fundingLakhs: number, projects: number): SubCriterionScore {
    const MAX = 30;
    const byProjects = projects >= 10 ? 1 : projects >= 5 ? 0.6 : projects >= 2 ? 0.3 : 0;
    const byFunding = fundingLakhs >= 50 ? 1 : fundingLakhs >= 20 ? 0.6 : fundingLakhs >= 5 ? 0.3 : 0;
    const f = Math.max(byProjects, byFunding);
    return this.sub('3.2', 'Research Funding', MAX, f,
      `${projects} projects, ₹${fundingLakhs}L funding`);
  }

  private score33_publications(publications: number, faculty: number): SubCriterionScore {
    const MAX = 30;
    const perFaculty = faculty > 0 ? publications / faculty : 0;
    const f = perFaculty >= 2 ? 1 : perFaculty >= 1 ? 0.7 : perFaculty >= 0.5 ? 0.4 : 0.1;
    return this.sub('3.3', 'Publications per Faculty', MAX, f,
      `${perFaculty.toFixed(2)} publications/faculty`);
  }

  private score34_publicationsAndPatents(publications: number, patents: number, faculty: number): SubCriterionScore {
    const MAX = 40;
    const perFaculty = faculty > 0 ? publications / faculty : 0;
    const pubF = perFaculty >= 3 ? 0.7 : perFaculty >= 1.5 ? 0.5 : perFaculty >= 0.5 ? 0.3 : 0.1;
    const patF = patents >= 5 ? 0.3 : patents >= 2 ? 0.2 : patents >= 1 ? 0.1 : 0;
    const f = Math.min(1, pubF + patF);
    return this.sub('3.4', 'Publications and Patents', MAX, f,
      `${publications} publications, ${patents} patents`);
  }

  // ─── Criterion IV — Infrastructure and Learning Resources ─────────────────

  computeCriterion4(input: Criterion4Input): CriterionScoreResult {
    const subScores: SubCriterionScore[] = [
      this.score41_physicalFacilities(input.classroomsWithICTPct),
      this.score42_library(input.libraryResourcesCount, input.totalStudents),
      this.score43_itInfrastructure(input.internetBandwidthMbps, input.totalStudents),
      this.score44_maintenance(input.maintenanceBudgetPct),
    ];
    return this.buildResult(4, 'Infrastructure and Learning Resources', subScores);
  }

  private score41_physicalFacilities(ictPct: number): SubCriterionScore {
    const MAX = 30;
    const f = ictPct >= 90 ? 1 : ictPct >= 70 ? 0.75 : ictPct >= 50 ? 0.5 : 0.25;
    return this.sub('4.1', 'ICT-Enabled Classrooms', MAX, f,
      `${ictPct.toFixed(0)}% classrooms with ICT`);
  }

  private score42_library(resources: number, students: number): SubCriterionScore {
    const MAX = 30;
    const perStudent = students > 0 ? resources / students : 0;
    // ≥20 books/student = full marks; NAAC benchmark for technical institutions
    const f = perStudent >= 20 ? 1 : perStudent >= 12 ? 0.75 : perStudent >= 6 ? 0.5 : 0.25;
    return this.sub('4.2', 'Library Resources per Student', MAX, f,
      `${perStudent.toFixed(1)} resources/student`);
  }

  private score43_itInfrastructure(bandwidthMbps: number, students: number): SubCriterionScore {
    const MAX = 25;
    const perStudent = students > 0 ? bandwidthMbps / students : 0;
    // Mbps per student: ≥0.1 = excellent, ≥0.05 = good, ≥0.02 = avg, <0.02 = poor
    const f = perStudent >= 0.1 ? 1 : perStudent >= 0.05 ? 0.7 : perStudent >= 0.02 ? 0.4 : 0.15;
    return this.sub('4.3', 'Internet Bandwidth per Student', MAX, f,
      `${bandwidthMbps}Mbps for ${students} students (${(perStudent * 1000).toFixed(1)} kbps/student)`);
  }

  private score44_maintenance(maintenancePct: number): SubCriterionScore {
    const MAX = 15;
    // ≥3% of budget on maintenance = good; AICTE guideline
    const f = maintenancePct >= 5 ? 1 : maintenancePct >= 3 ? 0.75 : maintenancePct >= 1.5 ? 0.5 : 0.25;
    return this.sub('4.4', 'Maintenance Budget Allocation', MAX, f,
      `${maintenancePct.toFixed(1)}% of budget for maintenance`);
  }

  // ─── Criterion V — Student Support and Progression ────────────────────────

  computeCriterion5(input: Criterion5Input): CriterionScoreResult {
    const subScores: SubCriterionScore[] = [
      this.score51_scholarships(input.scholarshipStudentsPct),
      this.score52_placement(input.placementPct),
      this.score53_higherStudies(input.higherStudiesPct),
      this.score54_studentAchievements(input.studentAchievementsCount),
      this.score55_alumni(input.alumniContributionsLakhs),
    ];
    return this.buildResult(5, 'Student Support and Progression', subScores);
  }

  private score51_scholarships(pct: number): SubCriterionScore {
    const MAX = 30;
    const f = pct >= 50 ? 1 : pct >= 30 ? 0.75 : pct >= 15 ? 0.5 : 0.2;
    return this.sub('5.1', 'Students Receiving Scholarships', MAX, f,
      `${pct.toFixed(1)}% students with scholarships`);
  }

  private score52_placement(placementPct: number): SubCriterionScore {
    const MAX = 40;
    const f = placementPct >= 80 ? 1 : placementPct >= 60 ? 0.75 : placementPct >= 40 ? 0.5 : 0.25;
    return this.sub('5.2', 'Campus Placement Rate', MAX, f,
      `${placementPct.toFixed(1)}% placed`);
  }

  private score53_higherStudies(pct: number): SubCriterionScore {
    const MAX = 20;
    const f = pct >= 20 ? 1 : pct >= 12 ? 0.7 : pct >= 6 ? 0.4 : 0.15;
    return this.sub('5.3', 'Progression to Higher Studies', MAX, f,
      `${pct.toFixed(1)}% graduates in higher studies`);
  }

  private score54_studentAchievements(count: number): SubCriterionScore {
    const MAX = 20;
    const f = count >= 20 ? 1 : count >= 10 ? 0.75 : count >= 5 ? 0.5 : count >= 1 ? 0.25 : 0;
    return this.sub('5.4', 'Student Awards / Sports Wins', MAX, f,
      `${count} state/national achievements`);
  }

  private score55_alumni(contributionsLakhs: number): SubCriterionScore {
    const MAX = 20;
    const f = contributionsLakhs >= 25 ? 1 : contributionsLakhs >= 10 ? 0.7 : contributionsLakhs >= 2 ? 0.4 : 0.1;
    return this.sub('5.5', 'Alumni Engagement & Contribution', MAX, f,
      `₹${contributionsLakhs}L alumni contribution`);
  }

  // ─── Criterion VI — Governance, Leadership and Management ─────────────────

  computeCriterion6(input: Criterion6Input): CriterionScoreResult {
    const subScores: SubCriterionScore[] = [
      this.score61_strategicPlan(input.strategicPlanScore),
      this.score62_iqac(input.iqacFunctionalityScore),
      this.score63_facultyEmpowerment(input.facultyAwardCount),
      this.score64_eGovernance(input.eGovernancePct),
      this.score65_auditCompliance(input.auditCompliancePct),
    ];
    return this.buildResult(6, 'Governance, Leadership and Management', subScores);
  }

  private score61_strategicPlan(score: number): SubCriterionScore {
    const MAX = 20;
    const f = score >= 80 ? 1 : score >= 60 ? 0.7 : score >= 40 ? 0.4 : 0.1;
    return this.sub('6.1', 'Strategic Plan Implementation', MAX, f,
      `Strategic plan score ${score.toFixed(0)}/100`);
  }

  private score62_iqac(score: number): SubCriterionScore {
    const MAX = 30;
    const f = score >= 80 ? 1 : score >= 60 ? 0.7 : score >= 40 ? 0.4 : 0.1;
    return this.sub('6.2', 'IQAC Functionality', MAX, f,
      `IQAC score ${score.toFixed(0)}/100`);
  }

  private score63_facultyEmpowerment(awards: number): SubCriterionScore {
    const MAX = 20;
    const f = awards >= 15 ? 1 : awards >= 8 ? 0.7 : awards >= 3 ? 0.4 : awards >= 1 ? 0.2 : 0;
    return this.sub('6.3', 'Faculty Awards and Recognitions', MAX, f,
      `${awards} faculty awards in 3 years`);
  }

  private score64_eGovernance(pct: number): SubCriterionScore {
    const MAX = 20;
    const f = pct >= 80 ? 1 : pct >= 60 ? 0.7 : pct >= 40 ? 0.4 : 0.2;
    return this.sub('6.4', 'E-Governance Implementation', MAX, f,
      `${pct.toFixed(0)}% processes digitalised`);
  }

  private score65_auditCompliance(pct: number): SubCriterionScore {
    const MAX = 10;
    const f = pct >= 95 ? 1 : pct >= 80 ? 0.7 : pct >= 60 ? 0.4 : 0.1;
    return this.sub('6.5', 'Internal Audit Compliance', MAX, f,
      `${pct.toFixed(1)}% audit compliance`);
  }

  // ─── Criterion VII — Institutional Values and Best Practices ──────────────

  computeCriterion7(input: Criterion7Input): CriterionScoreResult {
    const subScores: SubCriterionScore[] = [
      this.score71_greenCampus(input.greenInitiativesCount),
      this.score72_genderEquity(input.genderEquityProgramsCount),
      this.score73_bestPractices(input.bestPracticesCount),
      this.score74_distinctiveness(input.distinctivenessScore),
    ];
    return this.buildResult(7, 'Institutional Values and Best Practices', subScores);
  }

  private score71_greenCampus(count: number): SubCriterionScore {
    const MAX = 15;
    const f = count >= 8 ? 1 : count >= 5 ? 0.75 : count >= 3 ? 0.5 : count >= 1 ? 0.25 : 0;
    return this.sub('7.1', 'Green Campus Initiatives', MAX, f,
      `${count} environmental initiatives`);
  }

  private score72_genderEquity(count: number): SubCriterionScore {
    const MAX = 10;
    const f = count >= 5 ? 1 : count >= 3 ? 0.7 : count >= 1 ? 0.4 : 0;
    return this.sub('7.2', 'Gender Equity Programmes', MAX, f,
      `${count} gender equity programmes`);
  }

  private score73_bestPractices(count: number): SubCriterionScore {
    const MAX = 15;
    const f = count >= 3 ? 1 : count >= 2 ? 0.7 : count >= 1 ? 0.4 : 0;
    return this.sub('7.3', 'Documented Best Practices', MAX, f,
      `${count} NAAC-submitted best practices`);
  }

  private score74_distinctiveness(score: number): SubCriterionScore {
    const MAX = 10;
    const f = score >= 80 ? 1 : score >= 60 ? 0.7 : score >= 40 ? 0.4 : 0.1;
    return this.sub('7.4', 'Institutional Distinctiveness', MAX, f,
      `Distinctiveness score ${score.toFixed(0)}/100`);
  }

  // ─── Shared helpers ────────────────────────────────────────────────────────

  private sub(
    subCriterion: string,
    label: string,
    maxScore: number,
    fraction: number,
    rationaleDetail: string,
  ): SubCriterionScore {
    const score = Math.round(maxScore * fraction * 100) / 100;
    const pct = Math.round(fraction * 100);
    return {
      subCriterion,
      label,
      score,
      maxScore,
      pct,
      rationale: `${rationaleDetail} → ${pct}% of max`,
    };
  }

  private buildResult(
    criterion: number,
    label: string,
    subScores: SubCriterionScore[],
  ): CriterionScoreResult {
    const totalScore = subScores.reduce((s, sc) => s + sc.score, 0);
    const computedMax = subScores.reduce((s, sc) => s + sc.maxScore, 0);
    return {
      criterion,
      label,
      subScores,
      totalScore: Math.round(totalScore * 100) / 100,
      maxScore: computedMax,
      pct: computedMax > 0 ? Math.round((totalScore / computedMax) * 10000) / 100 : 0,
      disclaimer: DISCLAIMER,
    };
  }
}
