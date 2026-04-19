/**
 * DataExportsService
 *
 * Solves the principal's pain point: "data in different formats".
 *
 * Supported export formats:
 *  - CSV: machine-readable, importable in Excel/Google Sheets
 *  - Excel (XLSX): formatted spreadsheet with multiple sheets
 *  - PDF: printable report with institutional header
 *  - VTU Format: pipe-delimited or fixed-width format required by VTU portal
 *
 * Supported report types:
 *  1. Student Master List — all students with USN, name, dept, sem, contact
 *  2. Attendance Report — student-wise attendance % per subject
 *  3. Marks Report — IA1, IA2, best-of-2, final exam, total for VTU submission
 *  4. VTU Eligibility Report — which students are eligible for semester exams
 *  5. Fee Collection Report — semester-wise fee status per student
 *  6. Class Strength Report — enrollment counts per class
 */
import { Injectable } from '@nestjs/common';

export type ExportFormat = 'CSV' | 'XLSX' | 'PDF' | 'VTU';
export type ReportType =
  | 'STUDENT_MASTER'
  | 'ATTENDANCE'
  | 'MARKS'
  | 'VTU_ELIGIBILITY'
  | 'FEE_COLLECTION'
  | 'CLASS_STRENGTH';

export interface ExportRequest {
  reportType: ReportType;
  format: ExportFormat;
  filters?: {
    departmentCode?: string;
    semester?: number;
    classId?: string;
    academicYear?: string;
    fromDate?: string;
    toDate?: string;
  };
  requestedBy: string;
}

export interface ExportResult {
  jobId: string;
  reportType: ReportType;
  format: ExportFormat;
  status: 'READY' | 'PROCESSING' | 'FAILED';
  downloadUrl?: string;
  rowCount?: number;
  generatedAt: string;
  filters: Record<string, unknown>;
}

// ─── Mock data used for CSV/VTU generation ────────────────────────────────────

const MOCK_STUDENTS = [
  { usn: '1RV21CS001', name: 'Priya Sharma', dept: 'CSE', sem: 6, phone: '9876543210', email: 'priya@rvce.edu', feeStatus: 'PAID', attendancePct: 88, ia1: 18, ia2: 16, finalMarks: 72 },
  { usn: '1RV21CS002', name: 'Arjun Reddy', dept: 'CSE', sem: 6, phone: '9876543211', email: 'arjun@rvce.edu', feeStatus: 'PENDING', attendancePct: 68, ia1: 14, ia2: 15, finalMarks: 55 },
  { usn: '1RV21CS003', name: 'Bhavana Rao', dept: 'CSE', sem: 6, phone: '9876543212', email: 'bhavana@rvce.edu', feeStatus: 'PAID', attendancePct: 91, ia1: 19, ia2: 18, finalMarks: 78 },
  { usn: '1RV21CS004', name: 'Chetan Kumar', dept: 'CSE', sem: 6, phone: '9876543213', email: 'chetan@rvce.edu', feeStatus: 'PAID', attendancePct: 76, ia1: 15, ia2: 16, finalMarks: 61 },
  { usn: '1RV21CS005', name: 'Deepa Nair', dept: 'CSE', sem: 6, phone: '9876543214', email: 'deepa@rvce.edu', feeStatus: 'PAID', attendancePct: 71, ia1: 17, ia2: 14, finalMarks: 65 },
  { usn: '1RV21EC001', name: 'Eshan Mehta', dept: 'ECE', sem: 4, phone: '9876543215', email: 'eshan@rvce.edu', feeStatus: 'PAID', attendancePct: 84, ia1: 16, ia2: 17, finalMarks: 69 },
];

@Injectable()
export class DataExportsService {
  private readonly jobLog: ExportResult[] = [];

  /**
   * Generate a report. Returns job metadata + inline content for CSV/VTU.
   * For XLSX/PDF in production: generate file, upload to S3, return signed URL.
   */
  generateReport(req: ExportRequest): ExportResult & { content?: string } {
    const jobId = `export-${Date.now()}`;

    let content: string | undefined;
    let rowCount = 0;

    switch (req.reportType) {
      case 'STUDENT_MASTER':
        ({ content, rowCount } = this.generateStudentMaster(req.format, req.filters));
        break;
      case 'ATTENDANCE':
        ({ content, rowCount } = this.generateAttendanceReport(req.format, req.filters));
        break;
      case 'MARKS':
        ({ content, rowCount } = this.generateMarksReport(req.format, req.filters));
        break;
      case 'VTU_ELIGIBILITY':
        ({ content, rowCount } = this.generateVtuEligibility(req.format, req.filters));
        break;
      case 'FEE_COLLECTION':
        ({ content, rowCount } = this.generateFeeReport(req.format, req.filters));
        break;
      case 'CLASS_STRENGTH':
        ({ content, rowCount } = this.generateClassStrength(req.format, req.filters));
        break;
      default:
        content = 'Report type not implemented';
        rowCount = 0;
    }

    const result: ExportResult = {
      jobId,
      reportType: req.reportType,
      format: req.format,
      status: 'READY',
      rowCount,
      generatedAt: new Date().toISOString(),
      filters: req.filters ?? {},
      downloadUrl: `/api/exports/download/${jobId}`, // Phase 2: S3 signed URL
    };

    this.jobLog.push(result);
    return { ...result, content };
  }

  getJobHistory(): ExportResult[] {
    return [...this.jobLog].reverse();
  }

  // ─── Individual report generators ─────────────────────────────────────────

  private filterStudents(filters?: ExportRequest['filters']) {
    let students = [...MOCK_STUDENTS];
    if (filters?.departmentCode)
      students = students.filter((s) => s.dept === filters.departmentCode);
    if (filters?.semester)
      students = students.filter((s) => s.sem === filters.semester);
    return students;
  }

  private generateStudentMaster(
    format: ExportFormat,
    filters?: ExportRequest['filters'],
  ): { content: string; rowCount: number } {
    const students = this.filterStudents(filters);
    const headers = ['USN', 'Name', 'Department', 'Semester', 'Phone', 'Email', 'Fee Status'];

    if (format === 'VTU') {
      // VTU pipe-delimited format
      const rows = students.map((s) =>
        [s.usn, s.name, s.dept, s.sem, s.phone, s.email].join('|'),
      );
      return { content: ['USN|NAME|DEPT|SEM|PHONE|EMAIL', ...rows].join('\n'), rowCount: students.length };
    }

    // CSV (default for XLSX too — server would convert in production)
    const rows = students.map((s) =>
      [s.usn, `"${s.name}"`, s.dept, s.sem, s.phone, s.email, s.feeStatus].join(','),
    );
    return { content: [headers.join(','), ...rows].join('\n'), rowCount: students.length };
  }

  private generateAttendanceReport(
    format: ExportFormat,
    filters?: ExportRequest['filters'],
  ): { content: string; rowCount: number } {
    const students = this.filterStudents(filters);
    const headers = ['USN', 'Name', 'Department', 'Semester', 'Attendance %', 'Status'];

    if (format === 'VTU') {
      const rows = students.map((s) => {
        const eligible = s.attendancePct >= 75 ? 'E' : 'D'; // E=Eligible, D=Detained
        return [s.usn, s.name, s.dept, `SEM${s.sem}`, s.attendancePct, eligible].join('|');
      });
      return { content: ['USN|NAME|DEPT|SEM|ATT_PCT|ELIGIBLE', ...rows].join('\n'), rowCount: students.length };
    }

    const rows = students.map((s) => {
      const status = s.attendancePct >= 75 ? 'ELIGIBLE' : 'DETAINED';
      return [s.usn, `"${s.name}"`, s.dept, s.sem, `${s.attendancePct}%`, status].join(',');
    });
    return { content: [headers.join(','), ...rows].join('\n'), rowCount: students.length };
  }

  private generateMarksReport(
    format: ExportFormat,
    filters?: ExportRequest['filters'],
  ): { content: string; rowCount: number } {
    const students = this.filterStudents(filters);
    const headers = ['USN', 'Name', 'IA1', 'IA2', 'Best-of-2', 'Final Exam', 'Total', 'Grade'];

    const grade = (total: number) => {
      if (total >= 90) return 'O';
      if (total >= 80) return 'A+';
      if (total >= 70) return 'A';
      if (total >= 60) return 'B+';
      if (total >= 55) return 'B';
      if (total >= 50) return 'C';
      return 'F';
    };

    if (format === 'VTU') {
      // VTU marks submission format: USN|IA_BEST|SEE_MARKS
      const rows = students.map((s) => {
        const iaBest = Math.max(s.ia1, s.ia2);
        return [s.usn, s.name, iaBest, s.finalMarks].join('|');
      });
      return { content: ['USN|NAME|IA_BEST|SEE', ...rows].join('\n'), rowCount: students.length };
    }

    const rows = students.map((s) => {
      const iaBest = Math.max(s.ia1, s.ia2);
      const total = iaBest + s.finalMarks;
      return [s.usn, `"${s.name}"`, s.ia1, s.ia2, iaBest, s.finalMarks, total, grade(total)].join(',');
    });
    return { content: [headers.join(','), ...rows].join('\n'), rowCount: students.length };
  }

  private generateVtuEligibility(
    format: ExportFormat,
    filters?: ExportRequest['filters'],
  ): { content: string; rowCount: number } {
    const students = this.filterStudents(filters);
    const headers = ['USN', 'Name', 'Dept', 'Sem', 'Attendance %', 'IA Best', 'Fee Cleared', 'VTU Eligible'];

    const rows = students.map((s) => {
      const iaBest = Math.max(s.ia1, s.ia2);
      const eligible =
        s.attendancePct >= 75 &&
        iaBest >= 8 && // min 8/20 to appear for exam
        s.feeStatus === 'PAID';

      if (format === 'VTU') {
        return [s.usn, s.name, s.dept, `SEM${s.sem}`, s.attendancePct, iaBest, s.feeStatus, eligible ? 'Y' : 'N'].join('|');
      }
      return [s.usn, `"${s.name}"`, s.dept, s.sem, `${s.attendancePct}%`, iaBest, s.feeStatus, eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'].join(',');
    });

    return { content: [headers.join(format === 'VTU' ? '|' : ','), ...rows].join('\n'), rowCount: students.length };
  }

  private generateFeeReport(
    format: ExportFormat,
    filters?: ExportRequest['filters'],
  ): { content: string; rowCount: number } {
    const students = this.filterStudents(filters);
    const headers = ['USN', 'Name', 'Department', 'Semester', 'Fee Status'];
    const rows = students.map((s) =>
      [s.usn, `"${s.name}"`, s.dept, s.sem, s.feeStatus].join(format === 'VTU' ? '|' : ','),
    );
    return { content: [headers.join(format === 'VTU' ? '|' : ','), ...rows].join('\n'), rowCount: students.length };
  }

  private generateClassStrength(
    _format: ExportFormat,
    _filters?: ExportRequest['filters'],
  ): { content: string; rowCount: number } {
    const summary = [
      { dept: 'CSE', sem: 6, class: 'CSE 6A', strength: 60, present: 52, pct: 87 },
      { dept: 'CSE', sem: 6, class: 'CSE 6B', strength: 58, present: 48, pct: 83 },
      { dept: 'ECE', sem: 4, class: 'ECE 4A', strength: 55, present: 50, pct: 91 },
    ];
    const headers = ['Department', 'Semester', 'Class', 'Strength', 'Present Today', 'Attendance %'];
    const rows = summary.map((s) =>
      [s.dept, s.sem, s.class, s.strength, s.present, `${s.pct}%`].join(','),
    );
    return { content: [headers.join(','), ...rows].join('\n'), rowCount: summary.length };
  }
}
