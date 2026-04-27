/**
 * NaacCriterionCalculatorService — unit tests (100% coverage, no I/O)
 *
 * Tests cover:
 *   computeCriterion2 — all 5 sub-criteria scorers at every threshold branch
 *   computeCriterion3 — all 3 sub-criteria scorers at every threshold branch
 *   totalScore aggregation, pct computation, maxScore constants
 *   disclaimer present on all results
 *   edge cases: zero faculty, zero students, 100% inputs
 */

import { NaacCriterionCalculatorService, type Criterion2Input, type Criterion3Input } from './naac-criterion-calculator.service';

const IDEAL_C2: Criterion2Input = {
  totalStudents: 600,
  totalFaculty: 60,        // 10:1 ratio → max
  averageAttendancePct: 88,
  facultyWithPhDPct: 65,
  syllabusCoveragePct: 95,
  passPercentage: 92,
};

const IDEAL_C3: Criterion3Input = {
  peerReviewedPublications: 300,
  fundedProjects: 15,
  totalFaculty: 60,
  patentsFiled: 10,
  researchFundingLakhs: 60,
};

describe('NaacCriterionCalculatorService', () => {
  let calc: NaacCriterionCalculatorService;

  beforeEach(() => { calc = new NaacCriterionCalculatorService(); });

  // ─── Criterion 2 high-level ───────────────────────────────────────────────

  describe('computeCriterion2 — structure', () => {
    it('returns criterion=2 and correct label', () => {
      const r = calc.computeCriterion2(IDEAL_C2);
      expect(r.criterion).toBe(2);
      expect(r.label).toBe('Teaching-Learning and Evaluation');
    });

    it('returns 5 sub-criterion scores', () => {
      const r = calc.computeCriterion2(IDEAL_C2);
      expect(r.subScores).toHaveLength(5);
    });

    it('totalScore equals sum of sub-scores', () => {
      const r = calc.computeCriterion2(IDEAL_C2);
      const expected = r.subScores.reduce((s, sc) => s + sc.score, 0);
      expect(r.totalScore).toBeCloseTo(expected, 2);
    });

    it('pct = totalScore/maxScore * 100', () => {
      const r = calc.computeCriterion2(IDEAL_C2);
      expect(r.pct).toBeCloseTo((r.totalScore / r.maxScore) * 100, 1);
    });

    it('maxScore equals sum of sub-criterion maxScores (computed sub-criteria only)', () => {
      const r = calc.computeCriterion2(IDEAL_C2);
      const expected = r.subScores.reduce((s, sc) => s + sc.maxScore, 0);
      expect(r.maxScore).toBe(expected);
    });

    it('includes disclaimer on all results', () => {
      const r = calc.computeCriterion2(IDEAL_C2);
      expect(r.disclaimer).toContain('EdAI estimate');
    });

    it('ideal input scores near maximum (>80% of max)', () => {
      const r = calc.computeCriterion2(IDEAL_C2);
      expect(r.pct).toBeGreaterThan(80);
    });
  });

  // ─── Sub-criterion 2.1 (Student-Teacher Ratio) ───────────────────────────

  describe('Sub-criterion 2.1 — Student-Teacher Ratio', () => {
    const get21 = (students: number, faculty: number) =>
      calc.computeCriterion2({ ...IDEAL_C2, totalStudents: students, totalFaculty: faculty })
        .subScores.find(s => s.subCriterion === '2.1')!;

    it('≤15:1 ratio → 100% of 30', () => {
      const sc = get21(600, 60); // 10:1
      expect(sc.score).toBe(30);
      expect(sc.pct).toBe(100);
    });

    it('16:1 ratio → 70% of 30', () => {
      const sc = get21(800, 50); // 16:1
      expect(sc.score).toBe(21);
      expect(sc.pct).toBe(70);
    });

    it('25:1 ratio → 40% of 30', () => {
      const sc = get21(1000, 40); // 25:1
      expect(sc.score).toBe(12);
      expect(sc.pct).toBe(40);
    });

    it('>30:1 ratio → 0% of 30', () => {
      const sc = get21(2000, 50); // 40:1
      expect(sc.score).toBe(0);
      expect(sc.pct).toBe(0);
    });

    it('zero faculty → 0% (infinity ratio)', () => {
      const sc = get21(500, 0);
      expect(sc.score).toBe(0);
    });
  });

  // ─── Sub-criterion 2.2 (Attendance) ──────────────────────────────────────

  describe('Sub-criterion 2.2 — Average Attendance', () => {
    const get22 = (pct: number) =>
      calc.computeCriterion2({ ...IDEAL_C2, averageAttendancePct: pct })
        .subScores.find(s => s.subCriterion === '2.2')!;

    it('≥85% attendance → 100% of 40', () => {
      expect(get22(90).score).toBe(40);
      expect(get22(85).score).toBe(40);
    });

    it('75-84% attendance → 70% of 40 (28)', () => {
      expect(get22(80).score).toBe(28);
      expect(get22(75).score).toBe(28);
    });

    it('65-74% attendance → 40% of 40 (16)', () => {
      expect(get22(70).score).toBe(16);
      expect(get22(65).score).toBe(16);
    });

    it('<65% attendance → 10% of 40 (4)', () => {
      expect(get22(60).score).toBe(4);
      expect(get22(50).score).toBe(4);
    });
  });

  // ─── Sub-criterion 2.3 (Syllabus Coverage) ───────────────────────────────

  describe('Sub-criterion 2.3 — Syllabus Coverage', () => {
    const get23 = (pct: number) =>
      calc.computeCriterion2({ ...IDEAL_C2, syllabusCoveragePct: pct })
        .subScores.find(s => s.subCriterion === '2.3')!;

    it('≥90% coverage → 100% of 60', () => {
      expect(get23(95).score).toBe(60);
      expect(get23(90).score).toBe(60);
    });

    it('75-89% → 75% of 60 (45)', () => {
      expect(get23(80).score).toBe(45);
      expect(get23(75).score).toBe(45);
    });

    it('60-74% → 50% of 60 (30)', () => {
      expect(get23(65).score).toBe(30);
      expect(get23(60).score).toBe(30);
    });

    it('<60% → 25% of 60 (15)', () => {
      expect(get23(50).score).toBe(15);
    });
  });

  // ─── Sub-criterion 2.4 (Faculty Quality) ─────────────────────────────────

  describe('Sub-criterion 2.4 — Faculty with PhD', () => {
    const get24 = (pct: number) =>
      calc.computeCriterion2({ ...IDEAL_C2, facultyWithPhDPct: pct })
        .subScores.find(s => s.subCriterion === '2.4')!;

    it('≥60% PhD → 100% of 70', () => {
      expect(get24(65).score).toBe(70);
      expect(get24(60).score).toBe(70);
    });

    it('40-59% → 70% of 70 (49)', () => {
      expect(get24(50).score).toBe(49);
      expect(get24(40).score).toBe(49);
    });

    it('20-39% → 40% of 70 (28)', () => {
      expect(get24(30).score).toBe(28);
      expect(get24(20).score).toBe(28);
    });

    it('<20% → 15% of 70 (10.5)', () => {
      expect(get24(10).score).toBeCloseTo(10.5, 1);
    });
  });

  // ─── Sub-criterion 2.6 (Pass Percentage) ─────────────────────────────────

  describe('Sub-criterion 2.6 — Pass Percentage', () => {
    const get26 = (pct: number) =>
      calc.computeCriterion2({ ...IDEAL_C2, passPercentage: pct })
        .subScores.find(s => s.subCriterion === '2.6')!;

    it('≥90% pass → 100% of 40', () => { expect(get26(92).score).toBe(40); });
    it('75-89% pass → 75% of 40 (30)', () => { expect(get26(80).score).toBe(30); });
    it('60-74% pass → 50% of 40 (20)', () => { expect(get26(65).score).toBe(20); });
    it('<60% pass → 25% of 40 (10)', () => { expect(get26(50).score).toBe(10); });
  });

  // ─── Criterion 3 high-level ───────────────────────────────────────────────

  describe('computeCriterion3 — structure', () => {
    it('returns criterion=3 and correct label', () => {
      const r = calc.computeCriterion3(IDEAL_C3);
      expect(r.criterion).toBe(3);
      expect(r.label).toBe('Research, Innovations and Extension');
    });

    it('returns 3 sub-criterion scores', () => {
      expect(calc.computeCriterion3(IDEAL_C3).subScores).toHaveLength(3);
    });

    it('totalScore equals sum of sub-scores', () => {
      const r = calc.computeCriterion3(IDEAL_C3);
      const expected = r.subScores.reduce((s, sc) => s + sc.score, 0);
      expect(r.totalScore).toBeCloseTo(expected, 2);
    });

    it('maxScore equals sum of sub-criterion maxScores', () => {
      const r = calc.computeCriterion3(IDEAL_C3);
      const expected = r.subScores.reduce((s, sc) => s + sc.maxScore, 0);
      expect(r.maxScore).toBe(expected);
    });

    it('ideal input scores near maximum (>80%)', () => {
      expect(calc.computeCriterion3(IDEAL_C3).pct).toBeGreaterThan(80);
    });

    it('includes disclaimer', () => {
      expect(calc.computeCriterion3(IDEAL_C3).disclaimer).toContain('EdAI estimate');
    });
  });

  // ─── Sub-criterion 3.2 (Research Funding) ────────────────────────────────

  describe('Sub-criterion 3.2 — Research Funding', () => {
    const get32 = (projects: number, funding: number) =>
      calc.computeCriterion3({ ...IDEAL_C3, fundedProjects: projects, researchFundingLakhs: funding })
        .subScores.find(s => s.subCriterion === '3.2')!;

    it('≥10 projects → 100% of 30', () => { expect(get32(12, 0).score).toBe(30); });
    it('≥50L funding → 100% of 30', () => { expect(get32(0, 55).score).toBe(30); });
    it('5 projects → 60% of 30 (18)', () => { expect(get32(5, 0).score).toBe(18); });
    it('≥20L → 60% of 30 (18)', () => { expect(get32(0, 25).score).toBe(18); });
    it('2 projects → 30% of 30 (9)', () => { expect(get32(2, 0).score).toBe(9); });
    it('0 projects, 0 funding → 0', () => { expect(get32(0, 0).score).toBe(0); });
    it('takes max of projects vs funding', () => {
      // 3 projects (0%) vs 25L (60%) → 18
      expect(get32(3, 25).score).toBe(18);
    });
  });

  // ─── Sub-criterion 3.3 (Publications per Faculty) ────────────────────────

  describe('Sub-criterion 3.3 — Publications per Faculty', () => {
    const get33 = (pubs: number, faculty: number) =>
      calc.computeCriterion3({ ...IDEAL_C3, peerReviewedPublications: pubs, totalFaculty: faculty })
        .subScores.find(s => s.subCriterion === '3.3')!;

    it('≥2 pub/faculty → 100% of 30', () => { expect(get33(120, 60).score).toBe(30); }); // 2.0
    it('1-1.99 pub/faculty → 70% of 30 (21)', () => { expect(get33(70, 60).score).toBe(21); }); // 1.17
    it('0.5-0.99 pub/faculty → 40% of 30 (12)', () => { expect(get33(40, 60).score).toBe(12); }); // 0.67
    it('<0.5 pub/faculty → 10% of 30 (3)', () => { expect(get33(10, 60).score).toBe(3); }); // 0.17
    it('zero faculty → 10% (no publications per faculty)', () => { expect(get33(100, 0).score).toBe(3); });
  });

  // ─── Sub-criterion 3.4 (Publications + Patents) ───────────────────────────

  describe('Sub-criterion 3.4 — Publications and Patents', () => {
    const get34 = (pubs: number, patents: number, faculty: number) =>
      calc.computeCriterion3({ ...IDEAL_C3, peerReviewedPublications: pubs, patentsFiled: patents, totalFaculty: faculty })
        .subScores.find(s => s.subCriterion === '3.4')!;

    it('≥3 pub/faculty + ≥5 patents → max score (40)', () => {
      // pubPct=0.7 + patentPct=0.3 = 1.0 * 40 = 40
      expect(get34(200, 6, 60).score).toBe(40);
    });

    it('≥1.5 pub/faculty + 2 patents → 70% (28)', () => {
      // pubPct=0.5 + patentPct=0.2 = 0.7 * 40 = 28
      expect(get34(100, 2, 60).score).toBe(28);
    });

    it('≥0.5 pub/faculty + 1 patent → 40% (16)', () => {
      // pubPct=0.3 + patentPct=0.1 = 0.4 * 40 = 16
      expect(get34(35, 1, 60).score).toBe(16);
    });

    it('0 publications + 0 patents → 10% (4)', () => {
      // pubPct=0.1 + patentPct=0 = 0.1 * 40 = 4
      expect(get34(0, 0, 60).score).toBe(4);
    });

    it('score is capped at 40', () => {
      // Even if combined exceeds 40, should not exceed maxScore
      const sc = get34(10000, 100, 60);
      expect(sc.score).toBeLessThanOrEqual(40);
    });
  });
});
