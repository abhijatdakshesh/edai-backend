import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AttendanceRecord,
  AbsenceEscalation,
  EscalationLevel,
  EscalationAction,
} from '../entities/attendance-record.entity';
import {
  MarkAttendanceDto,
  MarkBulkAttendanceDto,
  AttendanceAbsentMarkedEvent,
} from '../dto/attendance.dto';

/**
 * In-memory store — replace with TypeORM repositories in production.
 * All Kafka emissions are stubbed (marked with // KAFKA:).
 */
@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);
  private records: AttendanceRecord[] = [];
  private escalations: AbsenceEscalation[] = [];

  async markAttendance(
    dto: MarkAttendanceDto,
  ): Promise<{ recordId: string; callScheduled: boolean }> {
    const record: AttendanceRecord = {
      id: randomUUID(),
      studentId: dto.studentId,
      institutionId: 'default',
      classId: dto.classId,
      subjectId: dto.subjectId,
      date: dto.date,
      period: dto.period,
      markedAt: new Date(),
      status: dto.status,
      markedBy: dto.markedBy,
      source: dto.source ?? 'MANUAL',
      callTriggered: false,
      createdAt: new Date(),
    };

    this.records.push(record);

    if (dto.status === 'ABSENT') {
      record.callTriggered = true;
      await this.emitAbsentEvent(record);
    }

    return { recordId: record.id, callScheduled: dto.status === 'ABSENT' };
  }

  async markBulk(
    dto: MarkBulkAttendanceDto,
  ): Promise<{ processed: number; absentCount: number }> {
    let absentCount = 0;
    for (const entry of dto.records) {
      const res = await this.markAttendance({
        studentId: entry.studentId,
        classId: dto.classId,
        date: dto.date,
        period: dto.period,
        subjectId: dto.subjectId,
        status: entry.status,
        markedBy: dto.markedBy,
      });
      if (entry.status === 'ABSENT') absentCount++;
    }
    return { processed: dto.records.length, absentCount };
  }

  async getStudentSummary(studentId: string): Promise<Record<string, unknown>> {
    const recs = this.records.filter((r) => r.studentId === studentId);
    const total = recs.length;
    const present = recs.filter((r) => r.status === 'PRESENT').length;
    const absent = recs.filter((r) => r.status === 'ABSENT').length;
    return {
      studentId,
      total,
      present,
      absent,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }

  async getClassToday(classId: string): Promise<AttendanceRecord[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.records.filter(
      (r) => r.classId === classId && r.date === today,
    );
  }

  async getAbsenteesToday(classId: string): Promise<AttendanceRecord[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.records.filter(
      (r) => r.classId === classId && r.date === today && r.status === 'ABSENT',
    );
  }

  async getAtRisk(institutionId?: string): Promise<Array<{ studentId: string; absenceCount: number }>> {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const cutoff = since.toISOString().slice(0, 10);

    const counts: Record<string, number> = {};
    for (const r of this.records) {
      if (r.status === 'ABSENT' && r.date >= cutoff) {
        counts[r.studentId] = (counts[r.studentId] ?? 0) + 1;
      }
    }

    return Object.entries(counts)
      .filter(([, count]) => count >= 3)
      .map(([studentId, absenceCount]) => ({ studentId, absenceCount }))
      .sort((a, b) => b.absenceCount - a.absenceCount);
  }

  async excuseAbsence(recordId: string, reason: string): Promise<AttendanceRecord | null> {
    const rec = this.records.find((r) => r.id === recordId);
    if (!rec) return null;
    rec.status = 'EXCUSED';
    rec.absenceReason = reason;
    return rec;
  }

  /**
   * Class-level summary — total conducted, present, absent, percentage.
   */
  async getClassSummary(classId: string): Promise<Record<string, unknown>> {
    const recs = this.records.filter((r) => r.classId === classId);
    const total = recs.length;
    const present = recs.filter((r) => r.status === 'PRESENT').length;
    const absent = recs.filter((r) => r.status === 'ABSENT').length;
    const late = recs.filter((r) => r.status === 'LATE').length;
    return {
      classId,
      total,
      present,
      absent,
      late,
      pct: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }

  /**
   * Students in a class below 75% threshold.
   * Used by teacher call panel.
   */
  async getClassAtRisk(classId: string): Promise<Array<{
    studentId: string;
    absencePct: number;
    consecutiveAbsences: number;
  }>> {
    const studentMap: Record<string, { total: number; absent: number; lastAbsentDates: string[] }> = {};

    for (const r of this.records.filter((rec) => rec.classId === classId)) {
      if (!studentMap[r.studentId]) {
        studentMap[r.studentId] = { total: 0, absent: 0, lastAbsentDates: [] };
      }
      studentMap[r.studentId]!.total++;
      if (r.status === 'ABSENT') {
        studentMap[r.studentId]!.absent++;
        studentMap[r.studentId]!.lastAbsentDates.push(r.date);
      }
    }

    const atRisk = [];
    for (const [studentId, data] of Object.entries(studentMap)) {
      const pct = data.total > 0 ? (data.absent / data.total) * 100 : 0;
      if (100 - pct < 75) { // present % < 75
        const sortedDates = data.lastAbsentDates.sort().reverse();
        let consecutive = 0;
        for (let i = 0; i < sortedDates.length - 1; i++) {
          const d1 = new Date(sortedDates[i]!);
          const d2 = new Date(sortedDates[i + 1]!);
          const diffDays = (d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays <= 1) consecutive++;
          else break;
        }
        atRisk.push({ studentId, absencePct: Math.round(pct), consecutiveAbsences: consecutive });
      }
    }

    return atRisk.sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences);
  }

  /**
   * VTU eligibility per subject for a student.
   * Returns per-subject attendance and whether student is eligible (>=75%).
   */
  async getVtuEligibility(studentUsn: string): Promise<Array<{
    subjectId: string;
    totalClasses: number;
    attended: number;
    pct: number;
    eligible: boolean;
    canMissMore: number;
    mustAttend: number;
  }>> {
    const subjectMap: Record<string, { total: number; attended: number }> = {};
    for (const r of this.records.filter((rec) => rec.studentId === studentUsn)) {
      if (!subjectMap[r.subjectId]) subjectMap[r.subjectId] = { total: 0, attended: 0 };
      subjectMap[r.subjectId]!.total++;
      if (r.status === 'PRESENT' || r.status === 'LATE') subjectMap[r.subjectId]!.attended++;
    }

    return Object.entries(subjectMap).map(([subjectId, { total, attended }]) => {
      const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
      const eligible = pct >= 75;
      // How many more can be missed staying above 75%
      const canMissMore = eligible ? Math.floor(attended - 0.75 * total) : 0;
      // How many must attend to reach 75% (if not eligible)
      const mustAttend = eligible ? 0 : Math.ceil(0.75 * total - attended);
      return { subjectId, totalClasses: total, attended, pct, eligible, canMissMore, mustAttend };
    });
  }

  /** Called by Kafka consumer when voice.call.completed arrives */
  async updateAbsenceReason(studentId: string, date: string, reason: string): Promise<void> {
    const rec = this.records.find(
      (r) => r.studentId === studentId && r.date === date && r.status === 'ABSENT',
    );
    if (rec) {
      rec.absenceReason = reason;
    }
  }

  /**
   * Escalation engine — runs daily at 09:45 via Bull cron.
   * Checks rolling 7-day window per student and emits escalation events.
   */
  async runEscalationEngine(): Promise<void> {
    this.logger.log('Running escalation engine…');
    const atRisk = await this.getAtRisk();

    for (const { studentId, absenceCount } of atRisk) {
      let level: EscalationLevel | null = null;
      let action: EscalationAction;

      if (absenceCount >= 10) {
        level = 'DAY10';
        action = 'PTM_SCHEDULED';
      } else if (absenceCount >= 7) {
        level = 'DAY7';
        action = 'TEACHER_ALERT';
      } else if (absenceCount >= 5) {
        level = 'DAY5';
        action = 'WHATSAPP_EMAIL';
      } else if (absenceCount >= 3) {
        level = 'DAY3';
        action = 'CALL';
      } else {
        continue;
      }

      const alreadyTriggered = this.escalations.find(
        (e) => e.studentId === studentId && e.escalationLevel === level,
      );
      if (alreadyTriggered) continue;

      const now = new Date();
      const escalation: AbsenceEscalation = {
        id: randomUUID(),
        studentId,
        institutionId: 'default',
        windowStart: (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })(),
        windowEnd: now.toISOString().slice(0, 10),
        absenceCount,
        escalationLevel: level,
        actionTaken: action,
        triggeredAt: now,
        createdAt: now,
      };
      this.escalations.push(escalation);

      // KAFKA: emit 'escalation.triggered' event
      this.logger.log(`Escalation ${level} triggered for student ${studentId}`);
    }
  }

  private async emitAbsentEvent(record: AttendanceRecord): Promise<void> {
    // KAFKA: emit 'attendance.absent.marked' to topic
    // Voice service and communications service subscribe to this topic.
    const event: AttendanceAbsentMarkedEvent = {
      eventId: randomUUID(),
      studentId: record.studentId,
      studentName: `Student:${record.studentId}`,
      classId: record.classId,
      institutionId: record.institutionId,
      date: record.date,
      period: record.period,
      parentId: `parent:${record.studentId}`,
      parentPhoneToken: 'encrypted-token',
      parentLanguage: 'kn',
      consentVoice: true,
      consentWhatsapp: true,
      teacherId: record.markedBy,
      markedAt: record.markedAt.getTime(),
    };
    this.logger.debug('KAFKA emit attendance.absent.marked: %j', event);
  }
}
