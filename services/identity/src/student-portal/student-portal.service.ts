import { Injectable } from '@nestjs/common';
import { AttendanceApiService } from '../attendance-api/attendance-api.service';
import { AssignmentsApiService } from '../assignments-api/assignments-api.service';
import { FeesApiService } from '../fees-api/fees-api.service';
import { CoursesService } from '../courses/courses.service';

export interface ScheduleEntry {
  dayOfWeek: string;
  subject: string;
  room: string;
  startTime: string;
  endTime: string;
}

export interface HostelInfo {
  roomNumber: string;
  block: string;
  warden: string;
  messMenu: Array<{ day: string; breakfast: string; lunch: string; dinner: string }>;
}

export interface TransportInfo {
  route: string;
  pickupPoint: string;
  timing: string;
}

export interface ExamPrepInfo {
  stressLevel: number;
  subjectReadiness: Array<{ subject: string; readiness: number; tip: string }>;
  resources: Array<{ title: string; url: string; type: string }>;
}

export interface StaffMember {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
}

@Injectable()
export class StudentPortalService {
  schedules: Map<string, ScheduleEntry[]> = new Map();
  hostelData: Map<string, { hostel: HostelInfo; transport: TransportInfo }> = new Map();
  staff: StaffMember[] = [];

  constructor(
    private readonly attendanceSvc: AttendanceApiService,
    private readonly assignmentsSvc: AssignmentsApiService,
    private readonly feesSvc: FeesApiService,
    private readonly coursesSvc: CoursesService,
  ) {}

  getDashboard(usn: string) {
    // --- Attendance ---
    let attendancePct = 85;
    const subjectAttendanceMap = new Map<string, number>();
    try {
      const attSummary = this.attendanceSvc.getStudentAttendance(usn);
      attendancePct = attSummary.overall;
      for (const sub of attSummary.subjects) {
        subjectAttendanceMap.set(sub.code, sub.pct);
      }
    } catch {
      attendancePct = 85;
    }

    // --- CGPA ---
    let cgpa = 7.8;
    try {
      const result = this.coursesSvc.getResults(usn);
      cgpa = result.cgpa;
    } catch {
      cgpa = 7.8;
    }

    // --- Pending assignments ---
    let pendingAssignments = 0;
    try {
      const asnData = this.assignmentsSvc.getStudentAssignments(usn);
      pendingAssignments = asnData.filter(
        (a) => a.status === 'PENDING' || a.status === 'LATE',
      ).length;
    } catch {
      pendingAssignments = 0;
    }

    // --- Fee status ---
    let feeStatus: 'PAID' | 'PENDING' | 'OVERDUE' | 'PARTIAL' = 'PAID';
    try {
      const fees = this.feesSvc.getStudentFees(usn);
      const hasOverdue = fees.items.some((f) => f.status === 'OVERDUE');
      const hasPending = fees.items.some((f) => f.status === 'PENDING');
      const hasPaid = fees.items.some((f) => f.status === 'PAID');
      if (hasOverdue) {
        feeStatus = 'OVERDUE';
      } else if (hasPending && hasPaid) {
        feeStatus = 'PARTIAL';
      } else if (hasPending) {
        feeStatus = 'PENDING';
      } else {
        feeStatus = 'PAID';
      }
    } catch {
      feeStatus = 'PAID';
    }

    // --- Courses with per-subject attendance and next scheduled class ---
    const schedule = this.schedules.get(usn) ?? this.schedules.get('default') ?? [];
    const courses = this.coursesSvc.getCourses().slice(0, 4).map((c) => {
      const nextEntry = schedule.find((s) => s.subject === c.name);
      const nextClass = nextEntry ? `${nextEntry.dayOfWeek}, ${nextEntry.startTime}` : 'TBD';
      return {
        code: c.code,
        name: c.name,
        faculty: c.instructorName,
        attendance: subjectAttendanceMap.get(c.code) ?? 85,
        nextClass,
      };
    });

    // --- Upcoming events derived from seeded assignments + static calendar ---
    const upcoming = [
      { date: 'Apr 25', event: 'Implement Binary Search Tree due', type: 'assignment' as const },
      { date: 'Apr 28', event: 'SQL Query Optimization due', type: 'assignment' as const },
      { date: 'May 02', event: 'Socket Programming Lab due', type: 'assignment' as const },
      { date: 'May 10', event: 'Mid-semester exams', type: 'exam' as const },
      { date: 'May 20', event: 'Project submission', type: 'event' as const },
    ];

    return {
      stats: {
        attendancePct,
        cgpa,
        pendingAssignments,
        feeStatus,
      },
      upcoming,
      courses,
    };
  }

  getSchedule(usn: string): { schedule: ScheduleEntry[] } {
    return { schedule: this.schedules.get(usn) ?? this.schedules.get('default') ?? [] };
  }

  getHostel(usn: string): { hostel: HostelInfo; transport: TransportInfo } {
    return (
      this.hostelData.get(usn) ??
      this.hostelData.get('default') ?? {
        hostel: {
          roomNumber: 'N/A',
          block: 'N/A',
          warden: 'N/A',
          messMenu: [],
        },
        transport: { route: 'N/A', pickupPoint: 'N/A', timing: 'N/A' },
      }
    );
  }

  getExamPrep(usn: string): ExamPrepInfo {
    return {
      stressLevel: 45,
      subjectReadiness: [
        { subject: 'Data Structures', readiness: 75, tip: 'Revise tree algorithms' },
        { subject: 'DBMS', readiness: 60, tip: 'Practice SQL queries' },
        { subject: 'Networks', readiness: 80, tip: 'Good progress, keep it up' },
      ],
      resources: [
        { title: 'Previous Year Papers', url: '/resources/pyq', type: 'pdf' },
        { title: 'Quick Revision Notes', url: '/resources/notes', type: 'article' },
      ],
    };
  }

  getStaff(): StaffMember[] {
    return this.staff;
  }
}
