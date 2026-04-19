import { Injectable, Logger } from '@nestjs/common';

interface RiskAssessment {
  studentId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
  assessedAt: string;
}

@Injectable()
export class EarlyWarningService {
  private readonly logger = new Logger(EarlyWarningService.name);

  assess(studentId: string, attendancePct: number, cgpa: number): RiskAssessment {
    const reasons: string[] = [];
    let riskScore = 0;

    if (attendancePct < 65) {
      reasons.push(`Attendance critically low: ${attendancePct}%`);
      riskScore += 50;
    } else if (attendancePct < 75) {
      reasons.push(`Attendance below threshold: ${attendancePct}%`);
      riskScore += 30;
    }

    if (cgpa < 4.0) {
      reasons.push(`CGPA critically low: ${cgpa}`);
      riskScore += 50;
    } else if (cgpa < 5.0) {
      reasons.push(`CGPA below pass threshold: ${cgpa}`);
      riskScore += 30;
    }

    const riskLevel =
      riskScore >= 80
        ? 'CRITICAL'
        : riskScore >= 60
          ? 'HIGH'
          : riskScore >= 30
            ? 'MEDIUM'
            : 'LOW';

    if (riskLevel !== 'LOW') {
      this.logger.warn(`AtRiskFlagged: student=${studentId} level=${riskLevel} score=${riskScore}`);
      // Production: emit AtRiskFlagged Kafka event here
    }

    return {
      studentId,
      riskScore,
      riskLevel,
      reasons,
      assessedAt: new Date().toISOString(),
    };
  }
}
