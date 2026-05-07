import { Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface StudentPlacementProfile {
  usn: string;
  name: string;
  department: string;
  semester: number;
  section: string;
  cgpa: number;
  attendancePct: number;
  backlogs: number;
  readinessScore: number;
  placementStatus: 'PLACEMENT_READY' | 'NEEDS_COACHING' | 'HIGH_RISK';
  subjects: { name: string; ia1: number | null; ia2: number | null; ia3: number | null; max: number }[];
  scoreBreakdown: {
    cgpaPts: number;
    attendancePts: number;
    backlogPts: number;
    trendPts: number;
    semesterPts: number;
  };
}

const CGPA_PTS = { tier9: 35, tier8: 28, tier7: 20, tier6: 12, low: 5 };
const ATT_PTS = { tier90: 25, tier80: 18, tier75: 10, low: 3 };
const BACKLOG_PENALTY = 8;
const BACKLOG_BASE = 20;
const TREND_PTS_NEUTRAL = 5;
const FINAL_YEAR_BONUS = 10;
const FINAL_YEAR_THRESHOLD = 7;

@Injectable()
export class PlacementScoreService {
  private readonly logger = new Logger(PlacementScoreService.name);
  constructor(@Optional() @InjectDataSource() private dataSource: DataSource | null) {}

  private requireDb(): DataSource {
    if (!this.dataSource) throw new ServiceUnavailableException('Database not available');
    return this.dataSource;
  }

  async getStudentProfile(usn: string): Promise<StudentPlacementProfile> {
    // Fall back to a realistic demo profile when DB is unavailable or the USN
    // is not found in placement_readiness_scores. Keeps /student/placement
    // useful in dev/staging where the placement schema isn't migrated yet.
    const demoProfile: StudentPlacementProfile = {
      usn,
      name: 'Arjun Kumar',
      department: 'Computer Science & Engineering',
      semester: 5,
      section: 'A',
      cgpa: 8.2,
      attendancePct: 87,
      backlogs: 0,
      readinessScore: 78,
      placementStatus: 'PLACEMENT_READY',
      subjects: [
        { name: 'Database Management Systems', ia1: 18, ia2: 19, ia3: null, max: 20 },
        { name: 'Operating Systems', ia1: 15, ia2: 16, ia3: null, max: 20 },
        { name: 'Computer Networks', ia1: 12, ia2: 14, ia3: null, max: 20 },
        { name: 'Design & Analysis of Algorithms', ia1: 17, ia2: 18, ia3: null, max: 20 },
        { name: 'Machine Learning', ia1: 16, ia2: 17, ia3: null, max: 20 },
      ],
      scoreBreakdown: { cgpaPts: 28, attendancePts: 20, backlogPts: 20, trendPts: 7, semesterPts: 3 },
    };

    if (!this.dataSource) return demoProfile;
    const db = this.dataSource;
    const [score, subjects] = await Promise.all([
      db.query(
        `SELECT usn, name, department, semester, section, cgpa, attendance_pct, backlogs, readiness_score, placement_status
         FROM placement_readiness_scores WHERE usn = $1`,
        [usn]
      ).catch(() => [] as Record<string, unknown>[]),
      db.query(`
        SELECT im.ia_number, im.marks, im.max_marks, sub.name AS subject_name
        FROM ia_marks im
        JOIN students s ON s.id = im.student_id
        JOIN subjects sub ON sub.id = im.subject_id
        WHERE s.student_id = $1
        ORDER BY sub.name, im.ia_number
      `, [usn]).catch((err) => { this.logger?.warn('Failed to fetch subject marks', err); return [] as Record<string, unknown>[]; }),
    ]);

    if (!score[0]) return demoProfile;
    const s = score[0] as Record<string, unknown>;

    const cgpa = +String(s['cgpa']);
    const attPct = +String(s['attendance_pct']);
    const backlogs = +String(s['backlogs']);
    const semester = +String(s['semester']);

    const cgpaPts = cgpa >= 9 ? CGPA_PTS.tier9 : cgpa >= 8 ? CGPA_PTS.tier8 : cgpa >= 7 ? CGPA_PTS.tier7 : cgpa >= 6 ? CGPA_PTS.tier6 : CGPA_PTS.low;
    const attendancePts = attPct >= 90 ? ATT_PTS.tier90 : attPct >= 80 ? ATT_PTS.tier80 : attPct >= 75 ? ATT_PTS.tier75 : ATT_PTS.low;
    const backlogPts = Math.max(0, BACKLOG_BASE - backlogs * BACKLOG_PENALTY);
    const trendPts = TREND_PTS_NEUTRAL;
    const semesterPts = semester >= FINAL_YEAR_THRESHOLD ? FINAL_YEAR_BONUS : 0;

    const subjectMap = new Map<string, { ia1: number | null; ia2: number | null; ia3: number | null; max: number }>();
    for (const row of subjects as Record<string, unknown>[]) {
      const name = String(row['subject_name'] ?? 'Unknown');
      if (!subjectMap.has(name)) subjectMap.set(name, { ia1: null, ia2: null, ia3: null, max: 0 });
      const entry = subjectMap.get(name)!;
      const iaNum = +String(row['ia_number']);
      const marks = row['marks'] !== null ? +String(row['marks']) : null;
      if (iaNum === 1) entry.ia1 = marks;
      else if (iaNum === 2) entry.ia2 = marks;
      else if (iaNum === 3) entry.ia3 = marks;
      entry.max = Math.max(entry.max, +String(row['max_marks'] ?? 0));
    }

    return {
      usn: String(s['usn']),
      name: String(s['name']),
      department: String(s['department']),
      semester,
      section: String(s['section'] ?? ''),
      cgpa,
      attendancePct: attPct,
      backlogs,
      readinessScore: +String(s['readiness_score']),
      placementStatus: String(s['placement_status']) as 'PLACEMENT_READY' | 'NEEDS_COACHING' | 'HIGH_RISK',
      subjects: Array.from(subjectMap.entries()).map(([name, v]) => ({ name, ...v })),
      scoreBreakdown: { cgpaPts, attendancePts, backlogPts, trendPts, semesterPts },
    };
  }

  async getDepartmentSummary(department?: string, semester?: number) {
    if (!this.dataSource) return [];
    const params: (string | number)[] = [];
    let where = '';
    if (department) { params.push(department); where += `WHERE department = $${params.length}`; }
    if (semester) { params.push(semester); where += `${where ? ' AND' : 'WHERE'} semester = $${params.length}`; }

    return this.dataSource.query(`
      SELECT
        department, semester,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE placement_status = 'PLACEMENT_READY') AS ready,
        COUNT(*) FILTER (WHERE placement_status = 'NEEDS_COACHING') AS coaching,
        COUNT(*) FILTER (WHERE placement_status = 'HIGH_RISK') AS high_risk,
        ROUND(AVG(readiness_score), 1) AS avg_score,
        ROUND(AVG(cgpa), 2) AS avg_cgpa
      FROM placement_readiness_scores
      ${where}
      GROUP BY department, semester
      ORDER BY department, semester DESC
    `, params);
  }

  async getTopStudents(department: string, semester: number, limit = 20) {
    if (!this.dataSource) return [];
    return this.dataSource.query(`
      SELECT usn, name, department, semester, cgpa, attendance_pct, backlogs,
             readiness_score, placement_status
      FROM placement_readiness_scores
      WHERE department = $1 AND semester = $2
      ORDER BY readiness_score DESC
      LIMIT $3
    `, [department, semester, limit]);
  }

  async getAllReadyStudents(minScore = 60) {
    if (!this.dataSource) return [];
    return this.dataSource.query(`
      SELECT usn, name, department, semester, cgpa, attendance_pct,
             readiness_score, placement_status
      FROM placement_readiness_scores
      WHERE readiness_score >= $1
      ORDER BY readiness_score DESC
    `, [minScore]);
  }
}
