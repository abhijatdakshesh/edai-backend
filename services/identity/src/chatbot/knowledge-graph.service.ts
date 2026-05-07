import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface TimetableSlot { time: string; subject: string; room: string; faculty: string; isLab: boolean; }
export interface SubjectAttendance { subject: string; present: number; total: number; percentage: number; classesNeededFor75: number; }
export interface SubjectMarksSummary { subject: string; ia1: number | null; ia2: number | null; maxMarks: number; }
export interface FeeStatus { totalFee: number; paid: number; balance: number; status: string; dueDate: string | null; }
export interface FeeComponent { component: string; amount: number; status: string; dueDate: string | null; }
export interface AtRiskStudent { usn: string; name: string; riskScore: number; riskLevel: string; primaryConcern: string; }
export interface TeacherScheduleSlot { time: string; subject: string; section: string; room: string; semester: number; }
export interface TeacherSubject { name: string; sections: string[]; totalStudents: number; avgAttendance: number; }
export interface Announcement { title: string; content: string; }
export interface PlacementDrive { company: string; status: string; scheduledDate: string; minCgpa: number; rounds: string[]; venue: string; eligibleDepts?: string[]; }
export interface VtuWindow { title: string; semester: number; openDate: string; closeDate: string; isActive: boolean; }
export interface VtuEligibility { windowTitle: string; isEligible: boolean; eligibleSubjects: string[]; registeredSubjects: string[]; openDate: string; closeDate: string; }
export interface AlumniStat { dept: string; avgPackageLpa: number; maxPackageLpa: number; totalAlumni: number; }
export interface AdminStats { totalStudents: number; totalFaculty: number; highRiskCount: number; feeDefaulterCount: number; activeConversations: number; }

export interface StudentKnowledgeGraph {
  role: 'STUDENT';
  name: string;
  usn: string;
  semester: number;
  section: string;
  department: string;
  parentName: string;
  preferredLanguage: string;
  todaySchedule: TimetableSlot[];
  weekSchedule: Record<string, TimetableSlot[]>;
  attendanceSummary: SubjectAttendance[];
  overallAttendancePct: number;
  detentionRisk: boolean;
  marksSummary: SubjectMarksSummary[];
  feeStatus: FeeStatus;
  feeBreakdown: FeeComponent[];
  riskScore: number;
  riskLevel: string;
  recentAbsenceCount: number;
  announcements: Announcement[];
  upcomingPlacements: PlacementDrive[];
  vtuWindow: VtuWindow | null;
  vtuEligibility: VtuEligibility | null;
  collegeName: string;
  academicYear: string;
}

export interface ParentKnowledgeGraph {
  role: 'PARENT';
  phone: string;
  preferredLanguage: string;
  child: Omit<StudentKnowledgeGraph, 'role'>;
  announcements: Announcement[];
}

export interface TeacherKnowledgeGraph {
  role: 'TEACHER';
  name: string;
  empId: string;
  department: string;
  preferredLanguage: string;
  todaySchedule: TeacherScheduleSlot[];
  weekSchedule: Record<string, TeacherScheduleSlot[]>;
  subjects: TeacherSubject[];
  atRiskStudents: AtRiskStudent[];
  totalStudents: number;
  announcements: Announcement[];
  collegeName: string;
}

export interface AdminKnowledgeGraph {
  role: 'ADMIN';
  name: string;
  empId: string;
  preferredLanguage: string;
  collegeName: string;
  academicYear: string;
  stats: AdminStats;
  atRiskStudents: AtRiskStudent[];
  announcements: Announcement[];
  upcomingPlacements: PlacementDrive[];
  alumniStats: AlumniStat[];
}

export type KnowledgeGraph = StudentKnowledgeGraph | ParentKnowledgeGraph | TeacherKnowledgeGraph | AdminKnowledgeGraph;

const GRAPH_TIMEOUT_MS = 5000;

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(
    @Optional() @InjectDataSource() private readonly db: DataSource | null,
  ) {}

  private todayName(): string {
    return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()];
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

      const [
        students, todaySlots, weekSlots, attendance, marks, fees, feeItems,
        risk, absences, announcements, placements, vtuWindows, vtuElig, vtuReg,
      ] = await Promise.all([
        this.db!.query(
          `SELECT name, semester, section, department,
                  COALESCE(preferred_language, 'en') AS lang,
                  COALESCE(parent_name, '') AS parent_name
           FROM students WHERE student_id = $1 LIMIT 1`, [usn],
        ).catch(() => []),
        this.db!.query(
          `SELECT ts.subject_name, ts.faculty_name,
                  ts.classroom_name AS room_number,
                  (ts.subject_type = 'LAB') AS is_lab,
                  ts.period AS slot_index
           FROM timetable_slots ts
           JOIN timetable_configs tc ON ts.config_id = tc.id
           JOIN students s ON s.section = ts.section AND s.semester = tc.semester
           WHERE s.student_id = $1 AND ts.day = $2 AND tc.status = 'PUBLISHED'
             AND ts.is_break = false AND ts.faculty_name != 'N/A'
           ORDER BY ts.period`, [usn, today],
        ).catch(() => []),
        this.db!.query(
          `SELECT ts.subject_name, ts.faculty_name,
                  ts.classroom_name AS room_number,
                  (ts.subject_type = 'LAB') AS is_lab,
                  ts.period AS slot_index, ts.day
           FROM timetable_slots ts
           JOIN timetable_configs tc ON ts.config_id = tc.id
           JOIN students s ON s.section = ts.section AND s.semester = tc.semester
           WHERE s.student_id = $1 AND tc.status = 'PUBLISHED'
             AND ts.is_break = false AND ts.faculty_name != 'N/A'
           ORDER BY ts.day, ts.period`, [usn],
        ).catch(() => []),
        this.db!.query(
          `SELECT subject_name,
                  COUNT(*) FILTER (WHERE status = 'PRESENT')::int AS present,
                  COUNT(*)::int AS total,
                  ROUND(COUNT(*) FILTER (WHERE status = 'PRESENT') * 100.0 / NULLIF(COUNT(*),0), 1)::float AS pct,
                  GREATEST(0, CEIL((0.75 * COUNT(*) - COUNT(*) FILTER (WHERE status='PRESENT')) / 0.25))::int AS needed
           FROM attendance WHERE student_id = $1
           GROUP BY subject_name ORDER BY pct ASC`, [usn],
        ).catch(() => []),
        this.db!.query(
          `SELECT subject_name,
                  MAX(CASE WHEN exam_type = 'IA1' THEN marks_obtained END)::float AS ia1,
                  MAX(CASE WHEN exam_type = 'IA2' THEN marks_obtained END)::float AS ia2,
                  MAX(max_marks)::int AS max_marks
           FROM internal_marks WHERE student_id = $1
           GROUP BY subject_name`, [usn],
        ).catch(() => []),
        this.db!.query(
          `SELECT total_amount::float, paid_amount::float,
                  (total_amount - paid_amount)::float AS balance,
                  payment_status, due_date
           FROM fee_payments WHERE student_id = $1
           ORDER BY created_at DESC LIMIT 1`, [usn],
        ).catch(() => []),
        this.db!.query(
          `SELECT component, amount::float, status, due_date
           FROM fee_items WHERE usn = $1
           ORDER BY component`, [usn],
        ).catch(() => []),
        this.db!.query(
          `SELECT risk_score::float, risk_level FROM student_risk_scores WHERE student_id = $1 LIMIT 1`, [usn],
        ).catch(() => []),
        this.db!.query(
          `SELECT COUNT(*)::int AS cnt FROM attendance
           WHERE student_id = $1 AND status = 'ABSENT'
             AND attendance_date >= CURRENT_DATE - INTERVAL '7 days'`, [usn],
        ).catch(() => [{ cnt: 0 }]),
        this.db!.query(
          `SELECT title, content FROM announcements
           WHERE audience IN ('STUDENT','ALL') ORDER BY created_at DESC LIMIT 5`,
        ).catch(() => []),
        this.db!.query(
          `SELECT company, status, scheduled_date, min_cgpa, rounds, venue, eligible_depts
           FROM placement_drives
           WHERE status = 'OPEN' AND scheduled_date >= CURRENT_DATE
           ORDER BY scheduled_date ASC LIMIT 5`,
        ).catch(() => []),
        this.db!.query(
          `SELECT title, semester, open_date, close_date, is_active
           FROM vtu_windows
           WHERE is_active = true AND semester = (SELECT semester FROM students WHERE student_id = $1)
           LIMIT 1`, [usn],
        ).catch(() => []),
        this.db!.query(
          `SELECT ve.eligible_subjects, ve.is_eligible, ve.category,
                  vw.title AS window_title, vw.open_date, vw.close_date
           FROM vtu_eligibilities ve
           JOIN vtu_windows vw ON vw.id = ve.window_id
           WHERE ve.usn = $1 AND vw.is_active = true LIMIT 1`, [usn],
        ).catch(() => []),
        this.db!.query(
          `SELECT vr.subject_codes
           FROM vtu_registrations vr
           JOIN vtu_windows vw ON vw.id = vr.window_id
           WHERE vr.usn = $1 AND vw.is_active = true LIMIT 1`, [usn],
        ).catch(() => []),
      ]);

      if (!students[0]) return this.emptyStudentGraph(usn);
      const s = students[0];

      const toSlot = (t: any): TimetableSlot => ({
        time: `Slot ${+t.slot_index + 1}`,
        subject: t.subject_name,
        room: t.room_number || 'TBD',
        faculty: t.faculty_name,
        isLab: !!t.is_lab,
      });

      const weekSchedule: Record<string, TimetableSlot[]> = {};
      for (const t of weekSlots as any[]) {
        const d = t.day as string;
        if (!weekSchedule[d]) weekSchedule[d] = [];
        weekSchedule[d].push(toSlot(t));
      }

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

      const eligRow = (vtuElig as any[])[0];
      const regRow = (vtuReg as any[])[0];

      return {
        role: 'STUDENT' as const,
        name: s.name,
        usn,
        semester: +s.semester,
        section: s.section,
        department: s.department,
        parentName: s.parent_name,
        preferredLanguage: s.lang,
        todaySchedule: (todaySlots as any[]).map(toSlot),
        weekSchedule,
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
          totalFee: +(fees[0]?.total_amount ?? 0),
          paid: +(fees[0]?.paid_amount ?? 0),
          balance: +(fees[0]?.balance ?? 0),
          status: fees[0].payment_status,
          dueDate: fees[0].due_date,
        } : { totalFee: 0, paid: 0, balance: 0, status: 'UNKNOWN', dueDate: null },
        feeBreakdown: (feeItems as any[]).map((f: any) => ({
          component: f.component,
          amount: +f.amount,
          status: f.status,
          dueDate: f.due_date ?? null,
        })),
        riskScore: risk[0] ? +risk[0].risk_score : 0,
        riskLevel: risk[0]?.risk_level ?? 'LOW',
        recentAbsenceCount: +absences[0]?.cnt || 0,
        announcements: (announcements as any[]).map(a => ({ title: a.title, content: a.content })),
        upcomingPlacements: (placements as any[]).map(p => ({
          company: p.company,
          status: p.status,
          scheduledDate: p.scheduled_date,
          minCgpa: +p.min_cgpa,
          rounds: p.rounds ?? [],
          venue: p.venue,
          eligibleDepts: p.eligible_depts ?? [],
        })),
        vtuWindow: vtuWindows[0] ? {
          title: vtuWindows[0].title,
          semester: +vtuWindows[0].semester,
          openDate: vtuWindows[0].open_date,
          closeDate: vtuWindows[0].close_date,
          isActive: vtuWindows[0].is_active,
        } : null,
        vtuEligibility: eligRow ? {
          windowTitle: eligRow.window_title,
          isEligible: !!eligRow.is_eligible,
          eligibleSubjects: eligRow.eligible_subjects ?? [],
          registeredSubjects: regRow?.subject_codes ?? [],
          openDate: eligRow.open_date,
          closeDate: eligRow.close_date,
        } : null,
        collegeName: 'RV College of Engineering, Bengaluru',
        academicYear: '2025-26',
      };
    };

    return this.withTimeout(build(), this.emptyStudentGraph(usn));
  }

  async buildParentGraph(phone: string): Promise<ParentKnowledgeGraph> {
    if (!this.db) {
      return { role: 'PARENT', phone, preferredLanguage: 'en', child: this.emptyStudentGraph('UNKNOWN'), announcements: [] };
    }

    const build = async () => {
      const rows = await this.db!.query(
        `SELECT student_id, COALESCE(preferred_language, 'en') AS lang
         FROM students WHERE parent_phone = $1 LIMIT 1`, [phone],
      );
      if (!rows[0]) throw new Error('Parent not found');

      const [childGraph, parentAnnouncements] = await Promise.all([
        this.buildStudentGraph(rows[0].student_id),
        this.db!.query(`SELECT title, content FROM announcements WHERE audience IN ('PARENT','ALL') ORDER BY created_at DESC LIMIT 5`),
      ]);
      return {
        role: 'PARENT' as const,
        phone,
        preferredLanguage: rows[0].lang,
        child: { ...childGraph, role: undefined as any },
        announcements: (parentAnnouncements as any[]).map(a => ({ title: a.title, content: a.content })),
      } as ParentKnowledgeGraph;
    };

    return this.withTimeout(build(), { role: 'PARENT', phone, preferredLanguage: 'en', child: this.emptyStudentGraph('UNKNOWN'), announcements: [] });
  }

  async buildTeacherGraph(empId: string): Promise<TeacherKnowledgeGraph> {
    if (!this.db) {
      return this.emptyTeacherGraph(empId);
    }

    const build = async () => {
      const today = this.todayName();

      const [teachers, todaySlots, weekSlots, subjects, atRisk, announcements] = await Promise.all([
        this.db!.query(
          `SELECT name, emp_id, department, COALESCE(preferred_language, 'en') AS lang
           FROM faculty WHERE emp_id = $1 LIMIT 1`, [empId],
        ),
        this.db!.query(
          `SELECT ts.period AS slot_index, ts.subject_name, ts.section,
                  ts.classroom_name AS room_number, tc.semester
           FROM timetable_slots ts
           JOIN timetable_configs tc ON ts.config_id = tc.id
           WHERE ts.faculty_name = (SELECT name FROM faculty WHERE emp_id = $1)
             AND ts.day = $2 AND tc.status = 'PUBLISHED'
             AND ts.is_break = false AND ts.faculty_name != 'N/A'
           ORDER BY ts.period`, [empId, today],
        ),
        this.db!.query(
          `SELECT ts.period AS slot_index, ts.subject_name, ts.section,
                  ts.classroom_name AS room_number, tc.semester, ts.day
           FROM timetable_slots ts
           JOIN timetable_configs tc ON ts.config_id = tc.id
           WHERE ts.faculty_name = (SELECT name FROM faculty WHERE emp_id = $1)
             AND tc.status = 'PUBLISHED'
             AND ts.is_break = false AND ts.faculty_name != 'N/A'
           ORDER BY ts.day, ts.period`, [empId],
        ),
        this.db!.query(
          `SELECT ts.subject_name,
                  STRING_AGG(DISTINCT ts.section, ', ') AS sections,
                  COUNT(DISTINCT s.student_id)::int AS total_students,
                  ROUND(AVG(COALESCE(att.pct,0)), 1)::float AS avg_att
           FROM timetable_slots ts
           JOIN timetable_configs tc ON ts.config_id = tc.id
           JOIN students s ON s.section = ts.section AND s.semester = tc.semester
           LEFT JOIN (
             SELECT student_id, subject_name,
                    ROUND(COUNT(*) FILTER (WHERE status='PRESENT') * 100.0 / NULLIF(COUNT(*),0), 1) AS pct
             FROM attendance GROUP BY student_id, subject_name
           ) att ON att.student_id = s.student_id AND att.subject_name = ts.subject_name
           WHERE ts.faculty_name = (SELECT name FROM faculty WHERE emp_id = $1)
             AND tc.status = 'PUBLISHED' AND ts.is_break = false
           GROUP BY ts.subject_name`, [empId],
        ),
        this.db!.query(
          `SELECT srs.student_usn AS usn, s.name, srs.risk_score::float, srs.risk_level,
                  COALESCE(srs.primary_concern, 'Low attendance') AS primary_concern
           FROM student_risk_scores srs
           JOIN students s ON s.student_id = srs.student_usn
           WHERE srs.risk_level IN ('HIGH','CRITICAL')
             AND s.section IN (
               SELECT DISTINCT ts2.section FROM timetable_slots ts2
               JOIN timetable_configs tc2 ON ts2.config_id = tc2.id
               WHERE ts2.faculty_name = (SELECT name FROM faculty WHERE emp_id = $1)
                 AND tc2.status = 'PUBLISHED'
             )
           ORDER BY srs.risk_score DESC LIMIT 20`, [empId],
        ),
        this.db!.query(
          `SELECT title, content FROM announcements
           WHERE audience IN ('FACULTY','ALL') ORDER BY created_at DESC LIMIT 5`,
        ),
      ]);

      if (!teachers[0]) return this.emptyTeacherGraph(empId);
      const t = teachers[0];

      const toTeacherSlot = (sl: any): TeacherScheduleSlot => ({
        time: `Slot ${+sl.slot_index + 1}`,
        subject: sl.subject_name,
        section: sl.section,
        room: sl.room_number || 'TBD',
        semester: +sl.semester,
      });

      const teacherWeekSchedule: Record<string, TeacherScheduleSlot[]> = {};
      for (const sl of weekSlots as any[]) {
        const d = sl.day as string;
        if (!teacherWeekSchedule[d]) teacherWeekSchedule[d] = [];
        teacherWeekSchedule[d].push(toTeacherSlot(sl));
      }

      return {
        role: 'TEACHER' as const,
        name: t.name,
        empId,
        department: t.department,
        preferredLanguage: t.lang,
        todaySchedule: (todaySlots as any[]).map(toTeacherSlot),
        weekSchedule: teacherWeekSchedule,
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
        announcements: (announcements as any[]).map(a => ({ title: a.title, content: a.content })),
        collegeName: 'RV College of Engineering, Bengaluru',
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
      parentName: '',
      preferredLanguage: 'en',
      todaySchedule: [],
      weekSchedule: {},
      attendanceSummary: [],
      overallAttendancePct: 0,
      detentionRisk: false,
      marksSummary: [],
      feeStatus: { totalFee: 0, paid: 0, balance: 0, status: 'UNKNOWN', dueDate: null },
      feeBreakdown: [],
      riskScore: 0,
      riskLevel: 'UNKNOWN',
      recentAbsenceCount: 0,
      announcements: [],
      upcomingPlacements: [],
      vtuWindow: null,
      vtuEligibility: null,
      collegeName: 'RV College of Engineering, Bengaluru',
      academicYear: '2025-26',
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
      weekSchedule: {},
      subjects: [],
      atRiskStudents: [],
      totalStudents: 0,
      announcements: [],
      collegeName: 'RV College of Engineering, Bengaluru',
    };
  }

  async buildAdminGraph(empId: string): Promise<AdminKnowledgeGraph> {
    if (!this.db) {
      return this.emptyAdminGraph(empId);
    }

    const build = async () => {
      const [adminRow, stats, atRisk, announcements, placements, alumniRows] = await Promise.all([
        this.db!.query(
          `SELECT name, COALESCE(preferred_language,'en') AS lang FROM faculty WHERE emp_id = $1 LIMIT 1`, [empId],
        ),
        this.db!.query(
          `SELECT
             (SELECT count(*)::int FROM students) AS total_students,
             (SELECT count(*)::int FROM faculty) AS total_faculty,
             (SELECT count(*)::int FROM student_risk_scores WHERE risk_level IN ('HIGH','CRITICAL')) AS high_risk_count,
             (SELECT count(*)::int FROM fee_payments WHERE payment_status IN ('PARTIAL','PENDING')) AS fee_defaulter_count,
             (SELECT count(*)::int FROM chat_conversations WHERE is_active = true) AS active_conversations`,
        ),
        this.db!.query(
          `SELECT srs.student_usn AS usn, s.name, srs.risk_score::float, srs.risk_level,
                  COALESCE(srs.primary_concern, 'Low attendance') AS primary_concern
           FROM student_risk_scores srs
           JOIN students s ON s.student_id = srs.student_usn
           WHERE srs.risk_level IN ('HIGH','CRITICAL')
           ORDER BY srs.risk_score DESC LIMIT 20`,
        ),
        this.db!.query(
          `SELECT title, content FROM announcements ORDER BY created_at DESC LIMIT 5`,
        ),
        this.db!.query(
          `SELECT company, status, scheduled_date, min_cgpa, rounds, venue
           FROM placement_drives WHERE status = 'OPEN' ORDER BY scheduled_date ASC LIMIT 5`,
        ),
        this.db!.query(
          `SELECT dept,
                  ROUND(AVG(package_lpa)::numeric, 1)::float AS avg_pkg,
                  MAX(package_lpa)::float AS max_pkg,
                  COUNT(*)::int AS total
           FROM alumni_outcomes
           GROUP BY dept ORDER BY avg_pkg DESC LIMIT 10`,
        ).catch(() => []),
      ]);

      const s = stats[0] ?? {};
      return {
        role: 'ADMIN' as const,
        name: adminRow[0]?.name ?? 'Administrator',
        empId,
        preferredLanguage: adminRow[0]?.lang ?? 'en',
        collegeName: 'RV College of Engineering, Bengaluru',
        academicYear: '2025-26',
        stats: {
          totalStudents: +s.total_students || 0,
          totalFaculty: +s.total_faculty || 0,
          highRiskCount: +s.high_risk_count || 0,
          feeDefaulterCount: +s.fee_defaulter_count || 0,
          activeConversations: +s.active_conversations || 0,
        },
        atRiskStudents: atRisk.map((r: any) => ({
          usn: r.usn, name: r.name,
          riskScore: +r.risk_score, riskLevel: r.risk_level, primaryConcern: r.primary_concern,
        })),
        announcements: (announcements as any[]).map(a => ({ title: a.title, content: a.content })),
        upcomingPlacements: (placements as any[]).map(p => ({
          company: p.company, status: p.status, scheduledDate: p.scheduled_date,
          minCgpa: +p.min_cgpa, rounds: p.rounds ?? [], venue: p.venue,
        })),
        alumniStats: (alumniRows as any[]).map(r => ({
          dept: r.dept,
          avgPackageLpa: +r.avg_pkg || 0,
          maxPackageLpa: +r.max_pkg || 0,
          totalAlumni: +r.total,
        })),
      };
    };

    return this.withTimeout(build(), this.emptyAdminGraph(empId));
  }

  private emptyAdminGraph(empId: string): AdminKnowledgeGraph {
    return {
      role: 'ADMIN',
      name: 'Administrator',
      empId,
      preferredLanguage: 'en',
      collegeName: 'RV College of Engineering, Bengaluru',
      academicYear: '2025-26',
      stats: { totalStudents: 0, totalFaculty: 0, highRiskCount: 0, feeDefaulterCount: 0, activeConversations: 0 },
      atRiskStudents: [],
      announcements: [],
      upcomingPlacements: [],
      alumniStats: [],
    };
  }
}
