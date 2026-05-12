import { Injectable, NotFoundException } from '@nestjs/common';
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

  /**
   * Register an explicit parent → student link.
   *
   * KAN-26: previously, if no mapping existed for a parent we silently
   * granted access to the seed student '1RV21CS001'. Admins creating a new
   * parent therefore appeared to auto-link to a random student. The link is
   * now explicit only — UsersService.create() calls this when role=PARENT
   * with the admin-supplied parentStudentUsn. No mapping → no access.
   */
  link(parentId: string, usn: string): void {
    if (!parentId || !usn) return;
    const existing = this.parentChildMap.get(parentId) ?? [];
    if (!existing.includes(usn)) existing.push(usn);
    this.parentChildMap.set(parentId, existing);
  }

  /** Returns true if parentId is linked to the given student USN */
  isParentOf(parentId: string, usn: string): boolean {
    const linked = this.parentChildMap.get(parentId);
    if (!linked) return false; // KAN-26: no implicit dev fallback
    return linked.includes(usn);
  }

  constructor(
    private readonly attendanceSvc: AttendanceApiService,
    private readonly feesSvc: FeesApiService,
    private readonly coursesSvc: CoursesService,
  ) {}

  getChildren(parentId: string): ChildInfo[] {
    // KAN-26: no implicit fallback. If admin never linked a student, the
    // dashboard correctly shows "no children" instead of leaking another
    // student's data.
    const usns = this.parentChildMap.get(parentId) ?? [];
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
      return { totalDue: 0, totalPaid: 0, totalOutstanding: 0, status: 'PENDING' as const, items: [] };
    }
  }

  getChild(
    usn: string,
  ): { usn: string; name: string; dept: string; semester: number; cgpa: number; attendancePct: number; feeStatus: string } {
    const profile = this.childProfiles.get(usn);
    return {
      usn,
      name: profile?.name ?? `Student ${usn}`,
      dept: profile?.dept ?? 'Computer Science',
      semester: profile?.semester ?? 5,
      cgpa: profile?.cgpa ?? 7.5,
      attendancePct: profile?.attendance ?? 80,
      feeStatus: 'PENDING',
    };
  }

  async payFees(usn: string, feeIds: string[]) {
    // Server-side amount computation — never trust client-supplied amount
    const feeSummary = this.feesSvc.getStudentFees(usn);
    const selectedFees = feeSummary.items.filter(
      (f) => feeIds.includes(f.id) && f.status !== 'PAID',
    );
    if (selectedFees.length === 0) throw new NotFoundException('No valid unpaid fees found for provided feeIds');
    const amount = selectedFees.reduce((sum, f) => sum + f.amount, 0);
    return this.feesSvc.initiatePaymentGateway(usn, amount, selectedFees.map((f) => f.id));
  }

  async verifyFeePayment(orderId: string, paymentId: string, signature: string) {
    return this.feesSvc.verifyPayment(orderId, paymentId, signature);
  }

  checkScholarship(
    usn: string,
  ): { eligible: boolean; schemes: Array<{ name: string; amount: number; criteria: string }> } {
    return {
      eligible: true,
      schemes: [
        { name: 'SC/ST Scholarship', amount: 25000, criteria: 'Category SC/ST with >75% attendance' },
        { name: 'Merit Scholarship', amount: 15000, criteria: 'CGPA >= 8.5 in previous semester' },
        { name: 'National Scholarship Portal', amount: 20000, criteria: 'Family income below 8 LPA' },
      ],
    };
  }
}
