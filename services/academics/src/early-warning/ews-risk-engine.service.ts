import { Injectable } from '@nestjs/common';
import type { RiskFactors, RiskLevel } from './entities/risk-snapshot.entity';
import type { RiskFactor } from './entities/scoring-weight.entity';
import { DEFAULT_WEIGHTS } from './entities/scoring-weight.entity';

export interface RiskInput {
  attendancePct: number | null;
  marksAvg: number | null;
  assignmentsSubmitted: number | null;
  assignmentsTotal: number | null;
  feesOverdueDays: number;
  examRegistered: boolean;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactors;
  reasons: string[];
}

/** Maps raw input to a 0-100 risk sub-score for each factor (higher = more at risk). */
function scoreAttendance(pct: number | null): number {
  if (pct === null) return 50; // unknown = medium risk
  if (pct < 55) return 100;
  if (pct < 65) return 80;
  if (pct < 75) return 50;
  if (pct < 85) return 20;
  return 0;
}

function scoreMarks(avg: number | null): number {
  if (avg === null) return 40;
  if (avg < 35) return 100;
  if (avg < 50) return 70;
  if (avg < 60) return 40;
  if (avg < 75) return 15;
  return 0;
}

function scoreFees(overdueDays: number): number {
  if (overdueDays <= 0) return 0;
  if (overdueDays <= 30) return 30;
  if (overdueDays <= 60) return 60;
  return 90;
}

function scoreAssignments(submitted: number | null, total: number | null): number {
  if (submitted === null || total === null || total === 0) return 30;
  const ratio = submitted / total;
  if (ratio >= 0.9) return 0;
  if (ratio >= 0.75) return 20;
  if (ratio >= 0.5) return 50;
  return 80;
}

function scoreExamReg(registered: boolean): number {
  return registered ? 0 : 100;
}

function toLevel(score: number): RiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

@Injectable()
export class EwsRiskEngineService {
  compute(input: RiskInput, weights: Record<RiskFactor, number> = DEFAULT_WEIGHTS): RiskResult {
    const sub: RiskFactors = {
      attendance: scoreAttendance(input.attendancePct),
      marks: scoreMarks(input.marksAvg),
      fees: scoreFees(input.feesOverdueDays),
      assignments: scoreAssignments(input.assignmentsSubmitted, input.assignmentsTotal),
      exam_reg: scoreExamReg(input.examRegistered),
    };

    const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
    const normalizedWeights = Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [k, v / totalWeight]),
    ) as Record<RiskFactor, number>;

    const score = Math.min(
      100,
      Math.round(
        (sub.attendance * normalizedWeights.attendance +
          sub.marks * normalizedWeights.marks +
          sub.fees * normalizedWeights.fees +
          sub.assignments * normalizedWeights.assignments +
          sub.exam_reg * normalizedWeights.exam_reg) *
          100,
      ) / 100,
    );

    const reasons: string[] = [];
    if (sub.attendance >= 50) reasons.push(`Attendance: ${input.attendancePct ?? 'unknown'}%`);
    if (sub.marks >= 40) reasons.push(`Marks avg: ${input.marksAvg ?? 'unknown'}`);
    if (sub.fees >= 30) reasons.push(`Fees overdue: ${input.feesOverdueDays} days`);
    if (sub.assignments >= 50) {
      reasons.push(
        `Assignments: ${input.assignmentsSubmitted ?? 0}/${input.assignmentsTotal ?? 0}`,
      );
    }
    if (!input.examRegistered) reasons.push('Not registered for exam');

    return { score, level: toLevel(score), factors: sub, reasons };
  }
}
