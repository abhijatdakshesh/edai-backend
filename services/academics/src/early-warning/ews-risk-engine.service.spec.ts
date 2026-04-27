/**
 * EwsRiskEngineService — unit tests (100% coverage, no I/O, no mocks)
 *
 * Covers:
 *   compute() — all factor scoring branches
 *   score → level mapping (LOW/MEDIUM/HIGH/CRITICAL)
 *   null inputs (unknown data treated as medium risk)
 *   weight normalization when weights don't sum to 1
 *   reasons array population
 *   boundary conditions (0%, 75%, 100% attendance etc.)
 */

import { EwsRiskEngineService } from './ews-risk-engine.service';
import { DEFAULT_WEIGHTS } from './entities/scoring-weight.entity';
import type { RiskInput } from './ews-risk-engine.service';

const CLEAN_STUDENT: RiskInput = {
  attendancePct: 90,
  marksAvg: 80,
  assignmentsSubmitted: 10,
  assignmentsTotal: 10,
  feesOverdueDays: 0,
  examRegistered: true,
};

const CRITICAL_STUDENT: RiskInput = {
  attendancePct: 40,
  marksAvg: 20,
  assignmentsSubmitted: 1,
  assignmentsTotal: 10,
  feesOverdueDays: 90,
  examRegistered: false,
};

describe('EwsRiskEngineService.compute', () => {
  let engine: EwsRiskEngineService;

  beforeEach(() => {
    engine = new EwsRiskEngineService();
  });

  // ── Level mapping ──────────────────────────────────────────────────────────

  it('returns LOW level for a healthy student', () => {
    const result = engine.compute(CLEAN_STUDENT);
    expect(result.level).toBe('LOW');
    expect(result.score).toBeLessThan(30);
  });

  it('returns CRITICAL level for a student with all risk factors maxed', () => {
    const result = engine.compute(CRITICAL_STUDENT);
    expect(result.level).toBe('CRITICAL');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('returns MEDIUM level for student with attendance 70% and low marks', () => {
    // att=70 → factor=50 (0.35*50=17.5), marks=45 → factor=70 (0.30*70=21) = 38.5 → MEDIUM
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: 70, marksAvg: 45 });
    expect(result.level).toBe('MEDIUM');
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.score).toBeLessThan(55);
  });

  it('returns HIGH level when attendance is below 55 and marks below 50', () => {
    // att=54 → factor=100 (0.35*100=35), marks=45 → factor=70 (0.30*70=21) = 56 → HIGH
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: 54, marksAvg: 45 });
    expect(result.level).toBe('HIGH');
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.score).toBeLessThan(75);
  });

  // ── Attendance scoring branches ────────────────────────────────────────────

  it('scores attendance=0 at max (100)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: 0 });
    expect(result.factors.attendance).toBe(100);
  });

  it('scores attendance=54 at 100 (below 55 threshold)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: 54 });
    expect(result.factors.attendance).toBe(100);
  });

  it('scores attendance=60 at 80 (55–65 range)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: 60 });
    expect(result.factors.attendance).toBe(80);
  });

  it('scores attendance=70 at 50 (65–75 range)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: 70 });
    expect(result.factors.attendance).toBe(50);
  });

  it('scores attendance=80 at 20 (75–85 range)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: 80 });
    expect(result.factors.attendance).toBe(20);
  });

  it('scores attendance=90 at 0 (≥85)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: 90 });
    expect(result.factors.attendance).toBe(0);
  });

  it('scores attendance=null at 50 (unknown)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: null });
    expect(result.factors.attendance).toBe(50);
  });

  // ── Marks scoring branches ─────────────────────────────────────────────────

  it('scores marksAvg=20 at 100 (below 35)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, marksAvg: 20 });
    expect(result.factors.marks).toBe(100);
  });

  it('scores marksAvg=40 at 70 (35–50 range)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, marksAvg: 40 });
    expect(result.factors.marks).toBe(70);
  });

  it('scores marksAvg=55 at 40 (50–60 range)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, marksAvg: 55 });
    expect(result.factors.marks).toBe(40);
  });

  it('scores marksAvg=65 at 15 (60–75 range)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, marksAvg: 65 });
    expect(result.factors.marks).toBe(15);
  });

  it('scores marksAvg=80 at 0 (≥75)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, marksAvg: 80 });
    expect(result.factors.marks).toBe(0);
  });

  it('scores marksAvg=null at 40', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, marksAvg: null });
    expect(result.factors.marks).toBe(40);
  });

  // ── Fees scoring branches ──────────────────────────────────────────────────

  it('scores feesOverdueDays=0 at 0', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, feesOverdueDays: 0 });
    expect(result.factors.fees).toBe(0);
  });

  it('scores feesOverdueDays=15 at 30 (1–30 range)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, feesOverdueDays: 15 });
    expect(result.factors.fees).toBe(30);
  });

  it('scores feesOverdueDays=45 at 60 (31–60 range)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, feesOverdueDays: 45 });
    expect(result.factors.fees).toBe(60);
  });

  it('scores feesOverdueDays=90 at 90 (>60)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, feesOverdueDays: 90 });
    expect(result.factors.fees).toBe(90);
  });

  // ── Assignments scoring branches ───────────────────────────────────────────

  it('scores assignments 10/10 at 0 (≥90%)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, assignmentsSubmitted: 10, assignmentsTotal: 10 });
    expect(result.factors.assignments).toBe(0);
  });

  it('scores assignments 8/10 at 20 (75–90%)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, assignmentsSubmitted: 8, assignmentsTotal: 10 });
    expect(result.factors.assignments).toBe(20);
  });

  it('scores assignments 6/10 at 50 (50–75%)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, assignmentsSubmitted: 6, assignmentsTotal: 10 });
    expect(result.factors.assignments).toBe(50);
  });

  it('scores assignments 3/10 at 80 (<50%)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, assignmentsSubmitted: 3, assignmentsTotal: 10 });
    expect(result.factors.assignments).toBe(80);
  });

  it('scores assignments null/null at 30 (unknown)', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, assignmentsSubmitted: null, assignmentsTotal: null });
    expect(result.factors.assignments).toBe(30);
  });

  it('scores assignments 5/0 (total=0 edge case) at 30', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, assignmentsSubmitted: 5, assignmentsTotal: 0 });
    expect(result.factors.assignments).toBe(30);
  });

  // ── Exam registration ──────────────────────────────────────────────────────

  it('scores examRegistered=true at 0', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, examRegistered: true });
    expect(result.factors.exam_reg).toBe(0);
  });

  it('scores examRegistered=false at 100', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, examRegistered: false });
    expect(result.factors.exam_reg).toBe(100);
  });

  // ── Reasons array ──────────────────────────────────────────────────────────

  it('populates no reasons for a clean student', () => {
    const result = engine.compute(CLEAN_STUDENT);
    expect(result.reasons).toHaveLength(0);
  });

  it('includes attendance reason when pct is low', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: 60 });
    expect(result.reasons.some((r) => r.includes('Attendance'))).toBe(true);
  });

  it('includes marks reason when avg is low', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, marksAvg: 40 });
    expect(result.reasons.some((r) => r.includes('Marks'))).toBe(true);
  });

  it('includes fees reason when overdue', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, feesOverdueDays: 20 });
    expect(result.reasons.some((r) => r.includes('Fees overdue'))).toBe(true);
  });

  it('includes assignments reason when submission rate is low', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, assignmentsSubmitted: 2, assignmentsTotal: 10 });
    expect(result.reasons.some((r) => r.includes('Assignments'))).toBe(true);
  });

  it('includes exam registration reason when not registered', () => {
    const result = engine.compute({ ...CLEAN_STUDENT, examRegistered: false });
    expect(result.reasons.some((r) => r.includes('Not registered for exam'))).toBe(true);
  });

  // ── Weight normalization ───────────────────────────────────────────────────

  it('uses default weights when called without explicit weights', () => {
    const r1 = engine.compute(CLEAN_STUDENT);
    const r2 = engine.compute(CLEAN_STUDENT, DEFAULT_WEIGHTS);
    expect(r1.score).toBe(r2.score);
  });

  it('normalizes weights that do not sum to 1', () => {
    const doubleWeights = { attendance: 0.70, marks: 0.60, fees: 0.30, assignments: 0.24, exam_reg: 0.16 };
    const result = engine.compute(CRITICAL_STUDENT, doubleWeights);
    // Score should still be in 0-100 range
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('produces same level when weights are doubled (normalization preserves ratios)', () => {
    const doubled = { attendance: 0.70, marks: 0.60, fees: 0.30, assignments: 0.24, exam_reg: 0.16 };
    const normal = engine.compute(CRITICAL_STUDENT, DEFAULT_WEIGHTS);
    const doubled_result = engine.compute(CRITICAL_STUDENT, doubled);
    expect(doubled_result.level).toBe(normal.level);
  });

  // ── Score clamped to 0-100 ────────────────────────────────────────────────

  it('score is always between 0 and 100', () => {
    const inputs: RiskInput[] = [CLEAN_STUDENT, CRITICAL_STUDENT, { ...CLEAN_STUDENT, attendancePct: null, marksAvg: null }];
    for (const input of inputs) {
      const result = engine.compute(input);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  // ── Level boundaries ──────────────────────────────────────────────────────

  it('score < 30 → LOW (attendance=74%, all else clean)', () => {
    // att=74 → factor=50, weighted: 50*0.35=17.5 → total score 18 → LOW
    const result = engine.compute({ ...CLEAN_STUDENT, attendancePct: 74 });
    expect(result.level).toBe('LOW');
    expect(result.score).toBeLessThan(30);
  });

  it('score ≥ 75 → CRITICAL', () => {
    const result = engine.compute(CRITICAL_STUDENT);
    expect(result.level).toBe('CRITICAL');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('score 55-74 → HIGH', () => {
    // attendance=60 (80*0.35=28), marks=40 (70*0.30=21), fees=0, assign=10/10 (0), exam=true (0)
    // total ≈ 49 → MEDIUM (not HIGH)
    // attendance=54 (100*0.35=35), marks=40 (70*0.30=21), fees=0, assign=5/10 (50*0.12=6), exam=true
    // = 35+21+6 = 62 → HIGH
    const result = engine.compute({ attendancePct: 54, marksAvg: 40, feesOverdueDays: 0, assignmentsSubmitted: 5, assignmentsTotal: 10, examRegistered: true });
    expect(result.level).toBe('HIGH');
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.score).toBeLessThan(75);
  });
});
