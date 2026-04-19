import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  MarksEntry,
  AiValidationFlag,
  AiValidationFlagType,
  DailyReport,
} from '../entities/marks.entity';

export interface BulkMarksEntryDto {
  subjectId: string;
  component: string;
  entries: Array<{ studentId: string; score: number | null }>;
  enteredBy: string;
}

export interface AiValidationResult {
  flags: AiValidationFlag[];
  flagCount: number;
  canProceed: boolean;
}

@Injectable()
export class MarksService {
  private readonly logger = new Logger(MarksService.name);
  private marks: MarksEntry[] = [];
  private reports: DailyReport[] = [];

  /**
   * POST /academics/marks/bulk — validates with AI before saving.
   * Returns validation flags; teacher must confirm to save.
   */
  validateBulk(dto: BulkMarksEntryDto): AiValidationResult {
    const scores = dto.entries
      .map((e) => e.score)
      .filter((s): s is number => s !== null);

    const mean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
    const stddev = Math.sqrt(
      scores.map((s) => (s - mean) ** 2).reduce((a, b) => a + b, 0) / (scores.length || 1),
    );

    const flags: AiValidationFlag[] = [];

    for (const entry of dto.entries) {
      const { studentId, score } = entry;

      if (score === null) {
        flags.push({
          studentId,
          studentName: `Student:${studentId}`,
          score: 0,
          flagType: 'MISSING_ENTRY',
          message: `Missing entry for student ${studentId}`,
        });
        continue;
      }

      if (score > 100) {
        flags.push({
          studentId,
          studentName: `Student:${studentId}`,
          score,
          flagType: 'INVALID_SCORE',
          message: `Score ${score} exceeds maximum 100`,
        });
      }

      if (stddev > 5 && Math.abs(score - mean) > 2 * stddev) {
        flags.push({
          studentId,
          studentName: `Student:${studentId}`,
          score,
          flagType: 'STATISTICAL_OUTLIER',
          message: `Statistical outlier — class avg ${mean.toFixed(1)}, this student: ${score}`,
          suggestion: `Verify with student's previous records`,
        });
      }

      if (score < 10 && score * 10 <= 100 && mean > 50) {
        flags.push({
          studentId,
          studentName: `Student:${studentId}`,
          score,
          flagType: 'DECIMAL_ERROR',
          message: `Possible decimal error: did you mean ${score * 10}?`,
          suggestion: `Check if score should be ${score * 10}`,
        });
      }
    }

    const uniqueScores = new Set(scores);
    if (uniqueScores.size === 1 && scores.length > 3) {
      for (const entry of dto.entries) {
        if (entry.score !== null) {
          flags.push({
            studentId: entry.studentId,
            studentName: `Student:${entry.studentId}`,
            score: entry.score,
            flagType: 'UNUSUAL_PATTERN',
            message: `All ${scores.length} students scored ${scores[0]} — verify`,
          });
        }
      }
    }

    return {
      flags,
      flagCount: flags.length,
      canProceed: flags.filter((f) => f.flagType === 'INVALID_SCORE').length === 0,
    };
  }

  /**
   * POST /academics/marks/bulk/confirm — saves after teacher reviews flags.
   */
  confirmBulk(dto: BulkMarksEntryDto, flags: AiValidationFlag[]): MarksEntry[] {
    const saved: MarksEntry[] = [];
    for (const entry of dto.entries) {
      if (entry.score === null) continue;
      const entryFlags = flags.filter((f) => f.studentId === entry.studentId);
      const mark: MarksEntry = {
        id: randomUUID(),
        studentId: entry.studentId,
        subjectId: dto.subjectId,
        institutionId: 'default',
        component: dto.component as never,
        score: entry.score,
        maxScore: 100,
        enteredBy: dto.enteredBy,
        aiValidationFlags: entryFlags.length > 0 ? entryFlags : undefined,
        status: entryFlags.length > 0 ? 'PENDING_REVIEW' : 'DRAFT',
        createdAt: new Date(),
      };
      this.marks.push(mark);
      saved.push(mark);
    }

    this.checkPerformanceDrop(dto.subjectId, saved);
    return saved;
  }

  getBySubject(subjectId: string): MarksEntry[] {
    return this.marks.filter((m) => m.subjectId === subjectId);
  }

  getByStudent(studentId: string): MarksEntry[] {
    return this.marks.filter((m) => m.studentId === studentId);
  }

  verify(entryId: string, verifiedBy: string): MarksEntry | null {
    const mark = this.marks.find((m) => m.id === entryId);
    if (!mark) return null;
    mark.verifiedBy = verifiedBy;
    mark.status = 'VERIFIED';
    return mark;
  }

  getTeacherReports(teacherId: string): DailyReport[] {
    return this.reports.filter((r) => r.teacherId === teacherId);
  }

  /**
   * Bull cron at 17:00 daily — generates teacher daily report.
   */
  async generateDailyReport(teacherId: string): Promise<DailyReport> {
    const report: DailyReport = {
      id: randomUUID(),
      teacherId,
      institutionId: 'default',
      reportDate: new Date().toISOString().slice(0, 10),
      contentJson: {
        generatedAt: new Date().toISOString(),
        pendingGrading: this.marks.filter(
          (m) => m.enteredBy === teacherId && m.status === 'PENDING_REVIEW',
        ).length,
        // Production: aggregate attendance, assignments, alerts from other services
      },
      createdAt: new Date(),
    };
    this.reports.push(report);
    // KAFKA: emit comms.teacher.daily-report for notifications service
    this.logger.debug('Daily report generated for teacher %s', teacherId);
    return report;
  }

  getAtRiskPredictions(teacherId: string): Array<{
    studentId: string;
    subjectId: string;
    riskReason: string;
    predictedScore: number;
  }> {
    // Stub: production uses ML model with attendance + assignment history
    return [];
  }

  private checkPerformanceDrop(subjectId: string, newEntries: MarksEntry[]): void {
    for (const entry of newEntries) {
      const history = this.marks
        .filter(
          (m) =>
            m.studentId === entry.studentId &&
            m.subjectId === subjectId &&
            m.status !== 'DRAFT',
        )
        .slice(-6);

      if (history.length < 3) continue;

      const rollingAvg =
        history.slice(0, -1).reduce((s, m) => s + m.score, 0) / (history.length - 1);
      const dropPercent = ((rollingAvg - entry.score) / rollingAvg) * 100;

      if (dropPercent > 15) {
        // KAFKA: emit academics.performance.drop
        this.logger.warn(
          'KAFKA emit academics.performance.drop: student=%s subject=%s drop=%.1f%%',
          entry.studentId,
          subjectId,
          dropPercent,
        );
      }
    }
  }
}
