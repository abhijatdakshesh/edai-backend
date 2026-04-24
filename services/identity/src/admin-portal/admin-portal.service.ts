import { Injectable } from '@nestjs/common';
import { FeesApiService } from '../fees-api/fees-api.service';

export interface AdminDashboard {
  totalStudents: number;
  totalFaculty: number;
  avgAttendance: number;
  feesCollected: number;
  alerts: Array<{ id: string; type: string; message: string; severity: string }>;
}

export interface AdminReport {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
}

export interface NaacReport {
  overallScore: number;
  criteria: Array<{ name: string; score: number; maxScore: number }>;
  strengths: string[];
  improvements: string[];
}

export interface BulkImportResult {
  jobId: string;
  entityType: string;
  status: string;
  message: string;
}

@Injectable()
export class AdminPortalService {
  constructor(private readonly feesSvc: FeesApiService) {}

  getDashboard(): AdminDashboard {
    const feesCollected = this.feesSvc.feeItems
      .filter((f) => f.status === 'PAID')
      .reduce((sum, f) => sum + f.amount, 0);

    return {
      totalStudents: 450,
      totalFaculty: 35,
      avgAttendance: 82,
      feesCollected,
      alerts: [
        {
          id: 'alert-1',
          type: 'ATTENDANCE',
          message: '12 students below 75% attendance',
          severity: 'HIGH',
        },
        {
          id: 'alert-2',
          type: 'FEES',
          message: '8 students with overdue fees',
          severity: 'MEDIUM',
        },
      ],
    };
  }

  getReports(): AdminReport[] {
    return [
      {
        id: 'rep-1',
        type: 'ATTENDANCE',
        label: 'Monthly Attendance Report',
        data: {
          month: 'April 2026',
          avgAttendance: 82,
          below75: 12,
          above90: 180,
        },
      },
      {
        id: 'rep-2',
        type: 'ACADEMIC',
        label: 'Semester Performance',
        data: {
          avgCGPA: 7.4,
          distinction: 45,
          fail: 8,
        },
      },
      {
        id: 'rep-3',
        type: 'FEES',
        label: 'Fee Collection Report',
        data: {
          totalExpected: 4500000,
          collected: 3800000,
          outstanding: 700000,
        },
      },
    ];
  }

  getNaac(): NaacReport {
    return {
      overallScore: 3.12,
      criteria: [
        { name: 'Curricular Aspects', score: 3.0, maxScore: 4.0 },
        { name: 'Teaching-Learning and Evaluation', score: 3.2, maxScore: 4.0 },
        { name: 'Research, Innovations and Extension', score: 2.8, maxScore: 4.0 },
        { name: 'Infrastructure and Learning Resources', score: 3.4, maxScore: 4.0 },
        { name: 'Student Support and Progression', score: 3.1, maxScore: 4.0 },
        { name: 'Governance, Leadership and Management', score: 3.0, maxScore: 4.0 },
        { name: 'Institutional Values and Best Practices', score: 3.3, maxScore: 4.0 },
      ],
      strengths: [
        'Strong industry partnerships for placements',
        'Modern infrastructure and labs',
        'Active research culture',
      ],
      improvements: [
        'Increase faculty PhD holders to 60%',
        'Expand international collaborations',
        'Improve student grievance resolution time',
      ],
    };
  }

  getAttendanceTrend() {
    return [
      { month: 'Oct 24', pct: 84 },
      { month: 'Nov 24', pct: 81 },
      { month: 'Dec 24', pct: 76 },
      { month: 'Jan 25', pct: 83 },
      { month: 'Feb 25', pct: 85 },
      { month: 'Mar 25', pct: 82 },
    ];
  }

  getFeeCollection() {
    return [
      { month: 'Jul 24', collected: 38, target: 45 },
      { month: 'Aug 24', collected: 42, target: 45 },
      { month: 'Sep 24', collected: 40, target: 45 },
      { month: 'Oct 24', collected: 43, target: 45 },
      { month: 'Nov 24', collected: 39, target: 45 },
      { month: 'Dec 24', collected: 41, target: 45 },
      { month: 'Jan 25', collected: 44, target: 45 },
      { month: 'Feb 25', collected: 38, target: 45 },
      { month: 'Mar 25', collected: 45, target: 45 },
    ];
  }

  getDeptAttendance() {
    return [
      { dept: 'CSE',  avgPct: 84, belowThreshold: 8 },
      { dept: 'ECE',  avgPct: 79, belowThreshold: 14 },
      { dept: 'ME',   avgPct: 76, belowThreshold: 18 },
      { dept: 'CV',   avgPct: 81, belowThreshold: 10 },
      { dept: 'ISE',  avgPct: 86, belowThreshold: 5 },
      { dept: 'EEE',  avgPct: 78, belowThreshold: 16 },
      { dept: 'AIML', avgPct: 88, belowThreshold: 3 },
    ];
  }

  getNaacMetrics() {
    const now = '2026-04-01T00:00:00.000Z';
    return {
      overallScore: 3.12,
      grade: 'A',
      lastAssessed: '2023-11-15',
      upcomingAuditDate: '2028-11-15',
      criteria: [
        { id: 'c1', name: 'Curricular Aspects', score: 3.0, maxScore: 4.0, lastUpdated: now, trend: 'STABLE' },
        { id: 'c2', name: 'Teaching-Learning and Evaluation', score: 3.2, maxScore: 4.0, lastUpdated: now, trend: 'UP' },
        { id: 'c3', name: 'Research, Innovations and Extension', score: 2.8, maxScore: 4.0, lastUpdated: now, trend: 'UP' },
        { id: 'c4', name: 'Infrastructure and Learning Resources', score: 3.4, maxScore: 4.0, lastUpdated: now, trend: 'STABLE' },
        { id: 'c5', name: 'Student Support and Progression', score: 3.1, maxScore: 4.0, lastUpdated: now, trend: 'UP' },
        { id: 'c6', name: 'Governance, Leadership and Management', score: 3.0, maxScore: 4.0, lastUpdated: now, trend: 'STABLE' },
        { id: 'c7', name: 'Institutional Values and Best Practices', score: 3.3, maxScore: 4.0, lastUpdated: now, trend: 'UP' },
      ],
      strengths: [
        'Strong industry partnerships for placements',
        'Modern infrastructure and labs',
        'Active research culture',
      ],
      areasForImprovement: [
        'Increase faculty PhD holders to 60%',
        'Expand international collaborations',
        'Improve student grievance resolution time',
      ],
    };
  }

  getPlacementSummary() {
    return {
      total: 420,
      high: 180,
      medium: 140,
      low: 65,
      veryLow: 35,
      avgCgpa: 7.4,
      avgSkillScore: 68,
    };
  }

  getPlacementPredictions(dept?: string, likelihood?: string) {
    const predictions = [
      {
        studentUsn: '1RV21CS001', studentName: 'Arjun Kumar', dept: 'CSE', semester: 7,
        cgpa: 8.2, attendancePct: 88, skillScore: 82, mockInterviewScore: 75,
        likelihood: 'HIGH', predictedPackage: '8-12 LPA',
        matchedCompanies: ['Infosys', 'Wipro', 'TCS', 'Accenture'],
        gaps: ['System Design', 'DSA - Advanced'],
      },
      {
        studentUsn: '1RV21CS002', studentName: 'Sneha Reddy', dept: 'CSE', semester: 7,
        cgpa: 7.9, attendancePct: 82, skillScore: 74, mockInterviewScore: 68,
        likelihood: 'HIGH', predictedPackage: '6-10 LPA',
        matchedCompanies: ['Infosys', 'Wipro', 'Capgemini'],
        gaps: ['Cloud Fundamentals'],
      },
      {
        studentUsn: '1RV21CS003', studentName: 'Priya Sharma', dept: 'CSE', semester: 7,
        cgpa: 6.8, attendancePct: 74, skillScore: 58, mockInterviewScore: 52,
        likelihood: 'MEDIUM', predictedPackage: '4-6 LPA',
        matchedCompanies: ['Wipro', 'HCL'],
        gaps: ['OOP Concepts', 'SQL', 'Communication Skills'],
      },
      {
        studentUsn: '1RV21CS004', studentName: 'Karan Joshi', dept: 'CSE', semester: 7,
        cgpa: 8.7, attendancePct: 92, skillScore: 91, mockInterviewScore: 88,
        likelihood: 'HIGH', predictedPackage: '12-18 LPA',
        matchedCompanies: ['Amazon', 'Microsoft', 'Google', 'Flipkart'],
        gaps: [],
      },
      {
        studentUsn: '1RV21CS005', studentName: 'Ravi Kumar', dept: 'CSE', semester: 7,
        cgpa: 5.9, attendancePct: 68, skillScore: 42,
        likelihood: 'LOW', predictedPackage: '3-4 LPA',
        matchedCompanies: ['HCL', 'Tech Mahindra'],
        gaps: ['Core CS Fundamentals', 'Coding Skills', 'Attendance'],
      },
      {
        studentUsn: '1RV21EC001', studentName: 'Kavya Gowda', dept: 'ECE', semester: 7,
        cgpa: 7.5, attendancePct: 85, skillScore: 70,
        likelihood: 'MEDIUM', predictedPackage: '5-8 LPA',
        matchedCompanies: ['Bosch', 'Continental', 'Qualcomm'],
        gaps: ['VLSI Design', 'Embedded Systems'],
      },
    ];

    let filtered = predictions;
    if (dept) filtered = filtered.filter((p) => p.dept === dept);
    if (likelihood) filtered = filtered.filter((p) => p.likelihood === likelihood);
    return filtered;
  }

  triggerBulkImport(
    entityType: string,
    fileUrl: string,
  ): BulkImportResult {
    return {
      jobId: `bulk-${Date.now()}`,
      entityType,
      status: 'QUEUED',
      message: `Bulk import for ${entityType} from ${fileUrl} has been queued`,
    };
  }
}
