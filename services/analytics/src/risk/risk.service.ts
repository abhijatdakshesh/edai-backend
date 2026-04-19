import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface RiskScore {
  studentId: string;
  institutionId: string;
  calculatedAt: Date;
  riskScore: number; // 0-100
  attendanceRisk: number;
  academicRisk: number;
  financialRisk: number;
  behavioralRisk: number;
  primaryRiskFactor: string;
  recommendedAction: string;
}

interface StudentMetrics {
  studentId: string;
  institutionId: string;
  attendancePct: number;
  avgPerformanceDrop: number;
  consecutiveMisses: number;
  daysOverdue: number;
  feeDefaultHistory: number;
  incidentCount30Days: number;
  incidentSeverityWeight: number;
}

const ACTION_MATRIX: Record<string, string> = {
  attendance: 'Schedule parent call and counsellor session',
  academic: 'Assign remedial classes and assign mentor',
  financial: 'Route to fee counsellor for EMI options',
  behavioral: 'Schedule mandatory PTM and counsellor assessment',
  combined: 'Immediate holistic intervention — assign case manager',
};

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);
  private riskScores: RiskScore[] = [];

  /**
   * Calculate composite risk score for a student.
   * Run daily at 22:00 via Bull cron.
   */
  calculateRisk(metrics: StudentMetrics): RiskScore {
    const attendanceRisk = Math.min(100, Math.round((100 - metrics.attendancePct) * 1.5));
    const academicRisk = Math.min(100, Math.round(metrics.avgPerformanceDrop * 2 + metrics.consecutiveMisses * 10));
    const financialRisk = Math.min(100, Math.round(metrics.daysOverdue * 8 + metrics.feeDefaultHistory * 15));
    const behavioralRisk = Math.min(100, Math.round(metrics.incidentCount30Days * 15 + metrics.incidentSeverityWeight * 20));

    const riskScore = Math.round(
      attendanceRisk * 0.35 +
      academicRisk * 0.35 +
      financialRisk * 0.20 +
      behavioralRisk * 0.10,
    );

    const factors = { attendance: attendanceRisk, academic: academicRisk, financial: financialRisk, behavioral: behavioralRisk };
    const primaryRiskFactor = Object.entries(factors).sort((a, b) => b[1] - a[1])[0][0];
    const recommendedAction = riskScore >= 70
      ? ACTION_MATRIX[primaryRiskFactor] ?? ACTION_MATRIX.combined
      : 'Continue monitoring';

    const score: RiskScore = {
      studentId: metrics.studentId,
      institutionId: metrics.institutionId,
      calculatedAt: new Date(),
      riskScore,
      attendanceRisk,
      academicRisk,
      financialRisk,
      behavioralRisk,
      primaryRiskFactor,
      recommendedAction,
    };

    this.riskScores = this.riskScores.filter((r) => r.studentId !== metrics.studentId);
    this.riskScores.push(score);
    return score;
  }

  getAtRiskStudents(institutionId: string, minScore = 30): RiskScore[] {
    return this.riskScores
      .filter((r) => r.institutionId === institutionId && r.riskScore >= minScore)
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  getRiskLabel(score: number): string {
    if (score >= 81) return 'Critical';
    if (score >= 61) return 'High';
    if (score >= 31) return 'Medium';
    return 'Low';
  }
}
