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
