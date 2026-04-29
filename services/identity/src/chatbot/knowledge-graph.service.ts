import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface TimetableSlot { time: string; subject: string; room: string; faculty: string; isLab: boolean; }
export interface SubjectAttendance { subject: string; present: number; total: number; percentage: number; classesNeededFor75: number; }
export interface SubjectMarksSummary { subject: string; ia1: number | null; ia2: number | null; maxMarks: number; }
export interface FeeStatus { totalFee: number; paid: number; balance: number; status: string; dueDate: string | null; }
export interface AtRiskStudent { usn: string; name: string; riskScore: number; riskLevel: string; primaryConcern: string; }
export interface TeacherScheduleSlot { time: string; subject: string; section: string; room: string; semester: number; }
export interface TeacherSubject { name: string; sections: string[]; totalStudents: number; avgAttendance: number; }

export interface StudentKnowledgeGraph {
  role: 'STUDENT';
  name: string;
  usn: string;
  semester: number;
  section: string;
  department: string;
  preferredLanguage: string;
  todaySchedule: TimetableSlot[];
  attendanceSummary: SubjectAttendance[];
  overallAttendancePct: number;
  detentionRisk: boolean;
  marksSummary: SubjectMarksSummary[];
  feeStatus: FeeStatus;
  riskScore: number;
  riskLevel: string;
  recentAbsenceCount: number;
}

export interface ParentKnowledgeGraph {
  role: 'PARENT';
  phone: string;
  preferredLanguage: string;
  child: Omit<StudentKnowledgeGraph, 'role'>;
}

export interface TeacherKnowledgeGraph {
  role: 'TEACHER';
  name: string;
  empId: string;
  department: string;
  preferredLanguage: string;
  todaySchedule: TeacherScheduleSlot[];
  subjects: TeacherSubject[];
  atRiskStudents: AtRiskStudent[];
  totalStudents: number;
}

export type KnowledgeGraph = StudentKnowledgeGraph | ParentKnowledgeGraph | TeacherKnowledgeGraph;

const GRAPH_TIMEOUT_MS = 5000;

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(
    @Optional() @InjectDataSource() private readonly db: DataSource | null,
  ) {}

  private todayName(): string {
    return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()];
  }

  private withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
    const timeout = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), GRAPH_TIMEOUT_MS));
    return Promise.race([promise, timeout]);
  }

  async buildStudentGraph(usn: string): Promise<StudentKnowledgeGraph> {
    if (!this.db) {
      return this.emptyStudentGraph(usn);
    }

    const build = async () => {
      const today = this.todayName();

      const [students, todaySlots, attendance, marks, fees, risk, absences] = await Promise.all([
        this.db!.query(
          `SELECT name, usn, semester, section, department, COALESCE(preferred_language, 'en') AS lang
           FROM students WHERE usn = $1 LIMIT 1`, [usn],
        ),
        this.db!.query(
          `SELECT ts.subject_name, ts.faculty_name, ts.room_number, ts.is_lab, ts.slot_index
           FROM timetable_slots ts
           JOIN timetable_configs tc ON ts.config_id = tc.id
           JOIN students s ON s.section = tc.section AND s.semester = tc.semester
           WHERE s.usn = $1 AND ts.day = $2 AND tc.is_active = true
           ORDER BY ts.slot_index`, [usn, today],
        ),
        this.db!.query(
          `SELECT subject_name,
                  COUNT(*) FILTER (WHERE status = 'PRESENT')::int AS present,
                  COUNT(*)::int AS total,
                  ROUND(COUNT(*) FILTER (WHERE status = 'PRESENT') * 100.0 / NULLIF(COUNT(*),0), 1)::float AS pct,
                  GREATEST(0, CEIL((0.75 * COUNT(*) - COUNT(*) FILTER (WHERE status='PRESENT')) / 0.25))::int AS needed
           FROM attendance WHERE student_usn = $1
           GROUP BY subject_name ORDER BY pct ASC`, [usn],
        ),
        this.db!.query(
          `SELECT subject_name,
                  MAX(CASE WHEN exam_type = 'IA1' THEN marks_obtained END)::float AS ia1,
                  MAX(CASE WHEN exam_type = 'IA2' THEN marks_obtained END)::float AS ia2,
                  MAX(max_marks)::int AS max_marks
           FROM internal_marks WHERE student_usn = $1
           GROUP BY subject_name`, [usn],
        ),
        this.db!.query(
          `SELECT total_amount::float, paid_amount::float,
                  (total_amount - paid_amount)::float AS balance,
                  payment_status, due_date
           FROM fee_payments WHERE student_usn = $1
           ORDER BY created_at DESC LIMIT 1`, [usn],
        ),
        this.db!.query(
          `SELECT risk_score::float, risk_level FROM student_risk_scores WHERE student_usn = $1 LIMIT 1`, [usn],
        ),
        this.db!.query(
          `SELECT COUNT(*)::int AS cnt FROM attendance
           WHERE student_usn = $1 AND status = 'ABSENT'
             AND attendance_date >= CURRENT_DATE - INTERVAL '7 days'`, [usn],
        ),
      ]);

      if (!students[0]) return this.emptyStudentGraph(usn);
      const s = students[0];

      const attSummary: SubjectAttendance[] = attendance.map((a: any) => ({
        subject: a.subject_name,
        present: +a.present,
        total: +a.total,
        percentage: +a.pct || 0,
        classesNeededFor75: +a.needed,
      }));
      const overallPct = attSummary.length
        ? Math.round(attSummary.reduce((sum, a) => sum + a.percentage, 0) / attSummary.length)
        : 0;

      return {
        role: 'STUDENT' as const,
        name: s.name,
        usn,
        semester: +s.semester,
        section: s.section,
        department: s.department,
        preferredLanguage: s.lang,
        todaySchedule: todaySlots.map((t: any) => ({
          time: `Slot ${+t.slot_index + 1}`,
          subject: t.subject_name,
          room: t.room_number || 'TBD',
          faculty: t.faculty_name,
          isLab: !!t.is_lab,
        })),
        attendanceSummary: attSummary,
        overallAttendancePct: overallPct,
        detentionRisk: attSummary.some(a => a.percentage < 75),
        marksSummary: marks.map((m: any) => ({
          subject: m.subject_name,
          ia1: m.ia1 !== null ? +m.ia1 : null,
          ia2: m.ia2 !== null ? +m.ia2 : null,
          maxMarks: +m.max_marks || 20,
        })),
        feeStatus: fees[0] ? {
          totalFee: +fees[0].total_amount,
          paid: +fees[0].paid_amount,
          balance: +fees[0].balance,
          status: fees[0].payment_status,
          dueDate: fees[0].due_date,
        } : { totalFee: 0, paid: 0, balance: 0, status: 'UNKNOWN', dueDate: null },
        riskScore: risk[0] ? +risk[0].risk_score : 0,
        riskLevel: risk[0]?.risk_level ?? 'LOW',
        recentAbsenceCount: +absences[0]?.cnt || 0,
      };
    };

    return this.withTimeout(build(), this.emptyStudentGraph(usn));
  }

  async buildParentGraph(phone: string): Promise<ParentKnowledgeGraph> {
    if (!this.db) {
      return { role: 'PARENT', phone, preferredLanguage: 'en', child: this.emptyStudentGraph('UNKNOWN') };
    }

    const build = async () => {
      const rows = await this.db!.query(
        `SELECT usn, COALESCE(preferred_language, 'en') AS lang
         FROM students WHERE parent_phone = $1 LIMIT 1`, [phone],
      );
      if (!rows[0]) throw new Error('Parent not found');

      const childGraph = await this.buildStudentGraph(rows[0].usn);
      return {
        role: 'PARENT' as const,
        phone,
        preferredLanguage: rows[0].lang,
        child: { ...childGraph, role: undefined as any },
      } as ParentKnowledgeGraph;
    };

    return this.withTimeout(build(), { role: 'PARENT', phone, preferredLanguage: 'en', child: this.emptyStudentGraph('UNKNOWN') });
  }

  async buildTeacherGraph(empId: string): Promise<TeacherKnowledgeGraph> {
    if (!this.db) {
      return this.emptyTeacherGraph(empId);
    }

    const build = async () => {
      const today = this.todayName();

      const [teachers, todaySlots, subjects, atRisk] = await Promise.all([
        this.db!.query(
          `SELECT name, emp_id, department, COALESCE(preferred_language, 'en') AS lang
           FROM faculty WHERE emp_id = $1 LIMIT 1`, [empId],
        ),
        this.db!.query(
          `SELECT ts.slot_index, ts.subject_name, ts.section, ts.room_number, tc.semester
           FROM timetable_slots ts
           JOIN timetable_configs tc ON ts.config_id = tc.id
           WHERE ts.faculty_name = (SELECT name FROM faculty WHERE emp_id = $1)
             AND ts.day = $2 AND tc.is_active = true
           ORDER BY ts.slot_index`, [empId, today],
        ),
        this.db!.query(
          `SELECT ts.subject_name,
                  STRING_AGG(DISTINCT tc.section, ', ') AS sections,
                  COUNT(DISTINCT s.usn)::int AS total_students,
                  ROUND(AVG(COALESCE(att.pct,0)), 1)::float AS avg_att
           FROM timetable_slots ts
           JOIN timetable_configs tc ON ts.config_id = tc.id
           JOIN students s ON s.section = tc.section AND s.semester = tc.semester
           LEFT JOIN (
             SELECT student_usn, subject_name,
                    ROUND(COUNT(*) FILTER (WHERE status='PRESENT') * 100.0 / NULLIF(COUNT(*),0), 1) AS pct
             FROM attendance GROUP BY student_usn, subject_name
           ) att ON att.student_usn = s.usn AND att.subject_name = ts.subject_name
           WHERE ts.faculty_name = (SELECT name FROM faculty WHERE emp_id = $1)
             AND tc.is_active = true
           GROUP BY ts.subject_name`, [empId],
        ),
        this.db!.query(
          `SELECT srs.student_usn AS usn, s.name, srs.risk_score::float, srs.risk_level,
                  COALESCE(srs.primary_concern, 'Low attendance') AS primary_concern
           FROM student_risk_scores srs
           JOIN students s ON s.usn = srs.student_usn
           WHERE srs.risk_level IN ('HIGH','CRITICAL')
             AND s.section IN (
               SELECT DISTINCT tc.section FROM timetable_slots ts
               JOIN timetable_configs tc ON ts.config_id = tc.id
               WHERE ts.faculty_name = (SELECT name FROM faculty WHERE emp_id = $1)
                 AND tc.is_active = true
             )
           ORDER BY srs.risk_score DESC LIMIT 20`, [empId],
        ),
      ]);

      if (!teachers[0]) return this.emptyTeacherGraph(empId);
      const t = teachers[0];

      return {
        role: 'TEACHER' as const,
        name: t.name,
        empId,
        department: t.department,
        preferredLanguage: t.lang,
        todaySchedule: todaySlots.map((sl: any) => ({
          time: `Slot ${+sl.slot_index + 1}`,
          subject: sl.subject_name,
          section: sl.section,
          room: sl.room_number || 'TBD',
          semester: +sl.semester,
        })),
        subjects: subjects.map((sub: any) => ({
          name: sub.subject_name,
          sections: String(sub.sections || '').split(', ').filter(Boolean),
          totalStudents: +sub.total_students,
          avgAttendance: +sub.avg_att || 0,
        })),
        atRiskStudents: atRisk.map((r: any) => ({
          usn: r.usn,
          name: r.name,
          riskScore: +r.risk_score,
          riskLevel: r.risk_level,
          primaryConcern: r.primary_concern,
        })),
        totalStudents: subjects.reduce((sum: number, s: any) => sum + (+s.total_students || 0), 0),
      };
    };

    return this.withTimeout(build(), this.emptyTeacherGraph(empId));
  }

  private emptyStudentGraph(usn: string): StudentKnowledgeGraph {
    return {
      role: 'STUDENT',
      name: 'Unknown',
      usn,
      semester: 0,
      section: '',
      department: '',
      preferredLanguage: 'en',
      todaySchedule: [],
      attendanceSummary: [],
      overallAttendancePct: 0,
      detentionRisk: false,
      marksSummary: [],
      feeStatus: { totalFee: 0, paid: 0, balance: 0, status: 'UNKNOWN', dueDate: null },
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      recentAbsenceCount: 0,
    };
  }

  private emptyTeacherGraph(empId: string): TeacherKnowledgeGraph {
    return {
      role: 'TEACHER',
      name: 'Unknown',
      empId,
      department: '',
      preferredLanguage: 'en',
      todaySchedule: [],
      subjects: [],
      atRiskStudents: [],
      totalStudents: 0,
    };
  }
}
