import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type AnomalySeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AuditAnomaly {
  id: string;
  institutionId: string;
  detectedAt: Date;
  anomalyType: string;
  severity: AnomalySeverity;
  description: string;
  resolved: boolean;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private anomalies: AuditAnomaly[] = [];

  /**
   * AI audit intelligence — runs daily at 23:00.
   * In production: query ClickHouse attendance_daily_agg + marks tables.
   */
  async runAuditChecks(institutionId: string): Promise<AuditAnomaly[]> {
    const found: AuditAnomaly[] = [];

    // Check 1: Attendance edit pattern
    const editAnomaly = await this.checkAttendanceEdits(institutionId);
    if (editAnomaly) found.push(editAnomaly);

    // Check 2: Grade clustering
    const gradeAnomaly = await this.checkGradeClustering(institutionId);
    if (gradeAnomaly) found.push(gradeAnomaly);

    // Check 3: Parent callback spike
    const callbackAnomaly = await this.checkCallbackSpike(institutionId);
    if (callbackAnomaly) found.push(callbackAnomaly);

    // Check 4: Teacher workload
    const workloadAnomalies = await this.checkTeacherWorkload(institutionId);
    found.push(...workloadAnomalies);

    this.anomalies.push(...found);
    return found;
  }

  getAnomalies(institutionId: string, days = 7): AuditAnomaly[] {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.anomalies
      .filter((a) => a.institutionId === institutionId && a.detectedAt >= since)
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  private async checkAttendanceEdits(institutionId: string): Promise<AuditAnomaly | null> {
    // Production: SELECT count, user_id FROM attendance_audit_log GROUP BY user_id, date
    return null; // stub
  }

  private async checkGradeClustering(institutionId: string): Promise<AuditAnomaly | null> {
    // Production: SELECT score, COUNT(*) FROM marks_entries GROUP BY score, subject_id
    return null; // stub
  }

  private async checkCallbackSpike(institutionId: string): Promise<AuditAnomaly | null> {
    // Production: compare today's callback count vs 7-day rolling average
    return null; // stub
  }

  private async checkTeacherWorkload(institutionId: string): Promise<AuditAnomaly[]> {
    // Production: query teacher_workload ClickHouse table
    return []; // stub
  }

  seedDemoAnomalies(institutionId: string): void {
    this.anomalies.push(
      {
        id: randomUUID(),
        institutionId,
        detectedAt: new Date(),
        anomalyType: 'GRADE_CLUSTERING',
        severity: 'WARNING',
        description: 'Grade distribution shows unusual clustering — 18 students scored exactly 72/100. Statistical review recommended.',
        resolved: false,
      },
      {
        id: randomUUID(),
        institutionId,
        detectedAt: new Date(),
        anomalyType: 'TEACHER_WORKLOAD',
        severity: 'INFO',
        description: 'Ms. Sharma at 128% of department average workload for 3 consecutive weeks. Consider redistributing 2 sections.',
        resolved: false,
      },
    );
  }
}
