import { Injectable } from '@nestjs/common';
import { AttendanceApiService } from '../attendance-api/attendance-api.service';
import { FeesApiService } from '../fees-api/fees-api.service';
import { CoursesService } from '../courses/courses.service';

export interface ChildInfo {
  usn: string;
  name: string;
  semester: number;
  dept: string;
  cgpa: number;
  attendance: number;
}

export interface ParentDashboard {
  children: ChildInfo[];
  pendingFees: number;
  recentNotifications: Array<{ id: string; message: string; sentAt: string }>;
}

@Injectable()
export class ParentPortalService {
  parentChildMap: Map<string, string[]> = new Map();
  childProfiles: Map<string, ChildInfo> = new Map();

  constructor(
    private readonly attendanceSvc: AttendanceApiService,
    private readonly feesSvc: FeesApiService,
    private readonly coursesSvc: CoursesService,
  ) {}

  getChildren(parentId: string): ChildInfo[] {
    const usns = this.parentChildMap.get(parentId) ?? ['1RV21CS001'];
    return usns.map((usn) => this.childProfiles.get(usn) ?? {
      usn,
      name: `Student ${usn}`,
      semester: 5,
      dept: 'Computer Science',
      cgpa: 7.5,
      attendance: 80,
    });
  }

  getDashboard(parentId: string): ParentDashboard {
    const children = this.getChildren(parentId);
    let pendingFees = 0;
    for (const child of children) {
      try {
        const fees = this.feesSvc.getStudentFees(child.usn);
        pendingFees += fees.totalOutstanding;
      } catch {
        // no fee data
      }
    }
    return {
      children,
      pendingFees,
      recentNotifications: [
        {
          id: 'notif-1',
          message: 'Your child was absent on 17-Apr',
          sentAt: new Date().toISOString(),
        },
      ],
    };
  }

  getChildAttendance(usn: string) {
    try {
      return this.attendanceSvc.getStudentAttendance(usn);
    } catch {
      return { overall: 80, subjects: [] };
    }
  }

  getChildResults(usn: string) {
    try {
      return this.coursesSvc.getResults(usn);
    } catch {
      return { usn, cgpa: 7.5, semesters: [] };
    }
  }

  getChildFees(usn: string) {
    try {
      return this.feesSvc.getStudentFees(usn);
    } catch {
      return { totalDue: 0, totalOutstanding: 0, items: [] };
    }
  }
}
