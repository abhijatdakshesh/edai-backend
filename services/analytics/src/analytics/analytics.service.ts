import { Injectable, Logger } from '@nestjs/common';
import { RiskService } from '../risk/risk.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly risk: RiskService,
    private readonly audit: AuditService,
  ) {}

  getDashboard(institutionId: string): Record<string, unknown> {
    const atRisk = this.risk.getAtRiskStudents(institutionId);
    const anomalies = this.audit.getAnomalies(institutionId);
    return {
      institutionId,
      generatedAt: new Date().toISOString(),
      kpis: {
        overallAttendanceToday: 84.2,
        feeCollectionMonthPercent: 67.5,
        aiCallsToday: { completed: 42, escalated: 3 },
        atRiskStudents: atRisk.length,
        overdueFees: { amount: 1240000, students: 28 },
        pendingAssignments: 134,
      },
      atRiskStudents: atRisk.slice(0, 20),
      auditAnomalies: anomalies,
    };
  }

  getAtRiskStudents(institutionId: string) {
    return this.risk.getAtRiskStudents(institutionId);
  }

  getTeacherWorkload(institutionId: string): unknown[] {
    // Production: query teacher_workload ClickHouse table
    return [
      {
        teacherId: 'teacher-1',
        name: 'Ms. Sharma',
        classesPerWeek: 24,
        papersGraded: 480,
        ptmsHeld: 3,
        workloadIndex: 1.28,
        isOverloaded: true,
      },
    ];
  }

  getSubjectIntelligence(institutionId: string): unknown[] {
    // Production: query subject_intelligence ClickHouse table
    return [
      {
        subjectId: 'sub-math',
        name: 'Mathematics',
        avgScore: 67.4,
        passRate: 0.72,
        conceptDifficulty: 'Linear Equations, Quadratic Expressions',
        strugglingStudentCount: 42,
      },
    ];
  }

  getAttendanceHeatmap(institutionId: string): unknown[] {
    // Production: query attendance_daily_agg grouped by dept × week
    return [];
  }

  getAuditAnomalies(institutionId: string) {
    return this.audit.getAnomalies(institutionId);
  }

  getYoYTrends(institutionId: string): Record<string, unknown> {
    return {
      attendanceTrend: [],
      feeTrend: [],
      academicTrend: [],
    };
  }
}
