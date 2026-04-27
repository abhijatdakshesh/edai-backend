import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';

export interface RiskScore {
  studentUsn: string;
  name: string;
  department: string;
  semester: number;
  section: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  attendancePct: number;
  failingSubjectCount: number;
  feeStatus: string;
  attTrendDelta: number;
  breakdown: {
    attendanceScore: number;
    marksScore: number;
    feeScore: number;
    trendScore: number;
  };
  computedAt: string;
}

export interface RiskSummary {
  department: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgRiskScore: number;
}

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async getAtRiskStudents(filters: {
    department?: string;
    semester?: number;
    riskLevel?: string;
    minScore?: number;
    limit?: number;
  }): Promise<RiskScore[]> {
    const { department, semester, riskLevel, minScore = 50, limit = 100 } = filters;

    let query = `
      SELECT
        student_usn   AS "studentUsn",
        name,
        department,
        semester,
        section,
        risk_score    AS "riskScore",
        risk_level    AS "riskLevel",
        attendance_pct        AS "attendancePct",
        failing_subject_count AS "failingSubjectCount",
        fee_status    AS "feeStatus",
        att_trend_delta       AS "attTrendDelta",
        att_score     AS "attScore",
        marks_score   AS "marksScore",
        fee_score     AS "feeScore",
        trend_score   AS "trendScore",
        computed_at   AS "computedAt"
      FROM student_risk_scores
      WHERE risk_score >= $1
    `;

    const params: unknown[] = [minScore];
    let paramIdx = 2;

    if (department) {
      query += ` AND department = $${paramIdx++}`;
      params.push(department);
    }
    if (semester) {
      query += ` AND semester = $${paramIdx++}`;
      params.push(semester);
    }
    if (riskLevel) {
      query += ` AND risk_level = $${paramIdx++}`;
      params.push(riskLevel.toUpperCase());
    }

    query += ` ORDER BY risk_score DESC LIMIT $${paramIdx}`;
    params.push(limit);

    const rows = await this.db.query(query, params);
    return rows.map((r: Record<string, unknown>) => ({
      studentUsn: r['studentUsn'],
      name: r['name'],
      department: r['department'],
      semester: Number(r['semester']),
      section: r['section'],
      riskScore: Number(r['riskScore']),
      riskLevel: r['riskLevel'] as RiskScore['riskLevel'],
      attendancePct: Number(r['attendancePct']),
      failingSubjectCount: Number(r['failingSubjectCount']),
      feeStatus: r['feeStatus'],
      attTrendDelta: Number(r['attTrendDelta']),
      breakdown: {
        attendanceScore: Number(r['attScore']),
        marksScore: Number(r['marksScore']),
        feeScore: Number(r['feeScore']),
        trendScore: Number(r['trendScore']),
      },
      computedAt: r['computedAt'],
    }));
  }

  async getStudentRisk(usn: string): Promise<RiskScore | null> {
    const rows = await this.db.query(
      `SELECT * FROM student_risk_scores WHERE student_usn = $1`,
      [usn],
    );
    if (!rows.length) return null;
    const r = rows[0] as Record<string, unknown>;
    return {
      studentUsn: r['student_usn'] as string,
      name: r['name'] as string,
      department: r['department'] as string,
      semester: Number(r['semester']),
      section: r['section'] as string,
      riskScore: Number(r['risk_score']),
      riskLevel: r['risk_level'] as RiskScore['riskLevel'],
      attendancePct: Number(r['attendance_pct']),
      failingSubjectCount: Number(r['failing_subject_count']),
      feeStatus: r['fee_status'] as string,
      attTrendDelta: Number(r['att_trend_delta']),
      breakdown: {
        attendanceScore: Number(r['att_score']),
        marksScore: Number(r['marks_score']),
        feeScore: Number(r['fee_score']),
        trendScore: Number(r['trend_score']),
      },
      computedAt: r['computed_at'] as string,
    };
  }

  async getDepartmentSummary(): Promise<RiskSummary[]> {
    const rows = await this.db.query(`
      SELECT
        department,
        COUNT(*)                                         AS total,
        COUNT(*) FILTER (WHERE risk_level = 'CRITICAL') AS critical,
        COUNT(*) FILTER (WHERE risk_level = 'HIGH')     AS high,
        COUNT(*) FILTER (WHERE risk_level = 'MEDIUM')   AS medium,
        COUNT(*) FILTER (WHERE risk_level = 'LOW')      AS low,
        ROUND(AVG(risk_score), 1)                       AS avg_risk_score
      FROM student_risk_scores
      GROUP BY department
      ORDER BY avg_risk_score DESC
    `);
    return rows.map((r: Record<string, unknown>) => ({
      department: r['department'] as string,
      total: Number(r['total']),
      critical: Number(r['critical']),
      high: Number(r['high']),
      medium: Number(r['medium']),
      low: Number(r['low']),
      avgRiskScore: Number(r['avg_risk_score']),
    }));
  }

  // Monday 8:00 AM IST = 02:30 UTC
  @Cron('30 2 * * 1')
  async sendWeeklyRiskDigest(): Promise<void> {
    this.logger.log('[Risk] Running Monday morning digest...');

    const [critical, high] = await Promise.all([
      this.getAtRiskStudents({ riskLevel: 'CRITICAL', limit: 200 }),
      this.getAtRiskStudents({ riskLevel: 'HIGH', limit: 200 }),
    ]);

    if (critical.length === 0 && high.length === 0) {
      this.logger.log('[Risk] No at-risk students this week. Digest skipped.');
      return;
    }

    const summary = await this.getDepartmentSummary();

    const byDept = new Map<string, RiskScore[]>();
    [...critical, ...high].forEach(s => {
      if (!byDept.has(s.department)) byDept.set(s.department, []);
      byDept.get(s.department)!.push(s);
    });

    for (const [dept, students] of byDept.entries()) {
      const deptSummary = summary.find(d => d.department === dept);
      await this.sendDeptDigestEmail(dept, students, deptSummary);
    }

    this.logger.log(
      `[Risk] Digest sent. Critical: ${critical.length}, High: ${high.length} across ${byDept.size} departments.`,
    );
  }

  private async sendDeptDigestEmail(
    department: string,
    students: RiskScore[],
    summary?: RiskSummary,
  ): Promise<void> {
    const hodRow = await this.db.query(
      `SELECT email, name FROM faculty WHERE department = $1 AND designation ILIKE '%hod%' LIMIT 1`,
      [department],
    );
    const hodEmail: string | undefined = hodRow[0]?.email ?? process.env['FALLBACK_ALERT_EMAIL'];
    const hodName: string = hodRow[0]?.name ?? 'HOD';

    if (!hodEmail) {
      this.logger.warn(`[Risk] No HOD email for ${department}, skipping.`);
      return;
    }

    const criticalStudents = students.filter(s => s.riskLevel === 'CRITICAL');
    const highStudents = students.filter(s => s.riskLevel === 'HIGH');

    const studentRows = students
      .slice(0, 20)
      .map(
        s =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${s.studentUsn}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${s.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${s.semester}th Sem ${s.section}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">
              <span style="background:${s.riskLevel === 'CRITICAL' ? '#F5E6E6' : '#FFF3CD'};color:${s.riskLevel === 'CRITICAL' ? '#8B2F2F' : '#8B6914'};padding:2px 8px;border-radius:20px;font-size:12px">
                ${s.riskScore} — ${s.riskLevel}
              </span>
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${s.attendancePct}%</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${s.failingSubjectCount} subject(s)</td>
          </tr>`,
      )
      .join('');

    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
    const dateStr = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
        <div style="background:#1a1a1a;padding:24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0">EdAI Weekly Risk Alert</h2>
          <p style="color:#aaa;margin:4px 0 0">${department} Department · ${dateStr}</p>
        </div>
        <div style="background:#fff;border:1px solid #eee;padding:24px">
          <p>Dear ${hodName},</p>
          <p>The following students in your department need attention this week:</p>
          <div style="display:flex;gap:16px;margin:16px 0">
            <div style="background:#F5E6E6;padding:16px;border-radius:8px;flex:1;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#8B2F2F">${criticalStudents.length}</div>
              <div style="font-size:13px;color:#8B2F2F">CRITICAL</div>
            </div>
            <div style="background:#FFF3CD;padding:16px;border-radius:8px;flex:1;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#8B6914">${highStudents.length}</div>
              <div style="font-size:13px;color:#8B6914">HIGH RISK</div>
            </div>
            <div style="background:#EBF3EE;padding:16px;border-radius:8px;flex:1;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#3D6B4F">${summary?.total ?? 0}</div>
              <div style="font-size:13px;color:#3D6B4F">TOTAL STUDENTS</div>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-top:16px">
            <thead>
              <tr style="background:#F9F7F4">
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B6358;border-bottom:2px solid #eee">USN</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B6358;border-bottom:2px solid #eee">Name</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B6358;border-bottom:2px solid #eee">Class</th>
                <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6B6358;border-bottom:2px solid #eee">Risk Score</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B6358;border-bottom:2px solid #eee">Attendance</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B6358;border-bottom:2px solid #eee">Failing</th>
              </tr>
            </thead>
            <tbody>${studentRows}</tbody>
          </table>
          ${students.length > 20 ? `<p style="color:#aaa;font-size:13px;margin-top:8px">+ ${students.length - 20} more. Log in to EdAI to see the full list.</p>` : ''}
          <div style="margin-top:24px;padding:16px;background:#F9F7F4;border-radius:8px;text-align:center">
            <a href="${frontendUrl}/admin/risk" style="background:#1a1a1a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px">
              View Full Dashboard →
            </a>
          </div>
        </div>
        <div style="background:#F9F7F4;padding:16px;text-align:center;border-radius:0 0 8px 8px">
          <p style="font-size:12px;color:#aaa;margin:0">EdAI by Raycraft Technologies · Auto-generated alert · Do not reply</p>
        </div>
      </div>
    `;

    // TODO: wire to mailer (nodemailer / @nestjs-modules/mailer) once configured.
    this.logger.log(
      `[Risk] Would send digest to ${hodEmail} for ${department}: ${criticalStudents.length} critical, ${highStudents.length} high. HTML length=${html.length}`,
    );
  }
}
