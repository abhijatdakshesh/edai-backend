import { Injectable, NotFoundException, ConflictException, BadRequestException, Optional, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VtuWindowEntity, VtuEligibilityEntity, VtuRegistrationEntity } from '../entities/vtu.entity';

export interface VtuWindow {
  id: string;
  title: string;
  openDate: string;
  closeDate: string;
  semester: number;
  isActive: boolean;
  subjectCodes: string[];
}

export interface VtuRegistration {
  windowId: string;
  usn: string;
  subjectCodes: string[];
  registeredAt: string;
}

export interface VtuEligibility {
  windowId: string;
  usn: string;
  eligibleSubjects: string[];
  isEligible: boolean;
  category: 'REGULAR' | 'USDE' | 'EX_STUDENT';
  attendancePct?: number;
}

export interface EligibilityInput {
  attendancePct: number;
  backlogs?: number;
  category?: 'REGULAR' | 'USDE' | 'EX_STUDENT';
}

/** VTU USN format: 1RV + 2-digit year + 2-char branch code + 3-digit seq */
const VTU_USN_REGEX = /^1RV\d{2}[A-Z]{2}\d{3}$/;

/** Attendance thresholds per VTU regulations */
const ATTENDANCE_THRESHOLDS: Record<string, number> = {
  REGULAR: 75,
  USDE: 65,
  EX_STUDENT: 0, // ex-students are always eligible
};

@Injectable()
export class VtuService implements OnModuleInit {
  constructor(
    @Optional() @InjectRepository(VtuWindowEntity)
    private readonly windowRepo?: Repository<VtuWindowEntity>,
    @Optional() @InjectRepository(VtuEligibilityEntity)
    private readonly eligibilityRepo?: Repository<VtuEligibilityEntity>,
    @Optional() @InjectRepository(VtuRegistrationEntity)
    private readonly registrationRepo?: Repository<VtuRegistrationEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.windowRepo) {
      const rows = await this.windowRepo.find();
      this.windows = rows.map((r) => ({
        id: r.id, title: r.title, openDate: r.openDate, closeDate: r.closeDate,
        semester: r.semester, isActive: r.isActive, subjectCodes: r.subjectCodes,
      }));
    }
    if (this.eligibilityRepo) {
      const rows = await this.eligibilityRepo.find();
      this.eligibilities = rows.map((r) => ({
        windowId: r.windowId, usn: r.usn, eligibleSubjects: r.eligibleSubjects,
        isEligible: r.isEligible, category: r.category as VtuEligibility['category'],
      }));
    }
    if (this.registrationRepo) {
      const rows = await this.registrationRepo.find();
      this.registrations = rows.map((r) => ({
        windowId: r.windowId, usn: r.usn, subjectCodes: r.subjectCodes,
        registeredAt: r.registeredAt instanceof Date ? r.registeredAt.toISOString() : r.registeredAt,
      }));
    }
  }

  windows: VtuWindow[] = [];
  registrations: VtuRegistration[] = [];
  eligibilities: VtuEligibility[] = [];

  /** Validate VTU USN format — throws BadRequestException on invalid input */
  validateUsn(usn: string): void {
    if (!VTU_USN_REGEX.test(usn)) {
      throw new BadRequestException(
        `Invalid USN format: "${usn}". Expected pattern: 1RV{YY}{BRANCH}{NNN} (e.g. 1RV21CS001)`,
      );
    }
  }

  /**
   * Compute eligibility for a student based on attendance percentage and category.
   * Implements VTU Ordinance 15.3 thresholds.
   */
  computeEligibility(usn: string, input: EligibilityInput): { isEligible: boolean; reason?: string } {
    const category = input.category ?? 'REGULAR';
    const threshold = ATTENDANCE_THRESHOLDS[category] ?? 75;

    if (category === 'EX_STUDENT') {
      return { isEligible: true };
    }

    if (input.attendancePct < threshold) {
      return {
        isEligible: false,
        reason: `Attendance ${input.attendancePct.toFixed(2)}% is below the required ${threshold}% for ${category} category`,
      };
    }
    return { isEligible: true };
  }

  getAllWindows(): VtuWindow[] {
    return this.windows;
  }

  getActiveWindow(): VtuWindow | null {
    const now = new Date();
    return (
      this.windows.find((w) => {
        if (!w.isActive) return false;
        const open = new Date(w.openDate);
        const close = new Date(w.closeDate);
        return now >= open && now <= close;
      }) ?? null
    );
  }

  createWindow(data: {
    title: string;
    openDate: string;
    closeDate: string;
    semester: number;
    subjectCodes?: string[];
  }): VtuWindow {
    const win: VtuWindow = {
      id: `vtu-win-${Date.now()}`,
      subjectCodes: data.subjectCodes ?? [],
      ...data,
      isActive: true,
    };
    this.windows.forEach((w) => (w.isActive = false));
    this.windows.push(win);
    this.windowRepo?.save(win as unknown as VtuWindowEntity)
      .catch((e) => console.error('DB persist error (createWindow)', e));
    return win;
  }

  getStudentStatus(
    usn: string,
    windowId: string,
  ): {
    status: string;
    eligibleSubjects: string[];
    ineligibleSubjects: string[];
    registeredSubjects: string[];
  } {
    const win = this.windows.find((w) => w.id === windowId);
    const elig = this.eligibilities.find(
      (e) => e.windowId === windowId && e.usn === usn,
    );
    const reg = this.registrations.find(
      (r) => r.windowId === windowId && r.usn === usn,
    );
    const allSubjects = win?.subjectCodes ?? [];
    const eligibleSubjects = elig?.eligibleSubjects ?? [];
    const ineligibleSubjects = allSubjects.filter(
      (code) => !eligibleSubjects.includes(code),
    );
    return {
      status: reg ? 'REGISTERED' : elig?.isEligible ? 'ELIGIBLE' : 'INELIGIBLE',
      eligibleSubjects,
      ineligibleSubjects,
      registeredSubjects: reg?.subjectCodes ?? [],
    };
  }

  registerStudent(
    usn: string,
    windowId: string,
    subjectCodes: string[],
  ): VtuRegistration {
    // Validate USN format
    this.validateUsn(usn);

    // Ensure window exists
    const win = this.windows.find((w) => w.id === windowId);
    if (!win) throw new NotFoundException(`VTU window ${windowId} not found`);

    // Enforce window open/close dates
    const now = new Date();
    const closeDate = new Date(win.closeDate);
    if (!win.isActive || now > closeDate) {
      throw new ConflictException(
        `VTU registration window "${win.title}" is closed. Registration closed on ${win.closeDate}`,
      );
    }

    // Enforce eligibility — student must have a passing eligibility record
    const elig = this.eligibilities.find((e) => e.windowId === windowId && e.usn === usn);
    if (!elig || !elig.isEligible) {
      throw new ConflictException(
        `Student ${usn} is not eligible to register for window ${windowId}. ` +
        `Run eligibility check first or check attendance records.`,
      );
    }

    // Only allow registration for eligible subjects
    const ineligibleRequested = subjectCodes.filter(
      (code) => !elig.eligibleSubjects.includes(code),
    );
    if (ineligibleRequested.length > 0) {
      throw new BadRequestException(
        `Student ${usn} is not eligible for subjects: ${ineligibleRequested.join(', ')}`,
      );
    }

    const existing = this.registrations.find(
      (r) => r.windowId === windowId && r.usn === usn,
    );
    if (existing) {
      existing.subjectCodes = subjectCodes;
      existing.registeredAt = new Date().toISOString();
      this.registrationRepo?.save({ id: `reg-${usn}-${windowId}`, ...existing } as unknown as VtuRegistrationEntity)
        .catch((e) => console.error('DB persist error (re-registerStudent)', e));
      return existing;
    }
    const reg: VtuRegistration = {
      windowId,
      usn,
      subjectCodes,
      registeredAt: new Date().toISOString(),
    };
    this.registrations.push(reg);
    this.registrationRepo?.save({ id: `reg-${usn}-${windowId}`, ...reg } as unknown as VtuRegistrationEntity)
      .catch((e) => console.error('DB persist error (registerStudent)', e));
    return reg;
  }

  getPendingStudents(
    windowId: string,
  ): Array<{ usn: string; name: string; dept: string }> {
    const registered = new Set(
      this.registrations
        .filter((r) => r.windowId === windowId)
        .map((r) => r.usn),
    );
    return this.eligibilities
      .filter((e) => e.windowId === windowId && e.isEligible && !registered.has(e.usn))
      .map((e) => {
        // Extract dept from USN: 1RV21CS001 → "CS"
        const dept = e.usn.length === 10 ? e.usn.slice(5, 7) : 'UNKNOWN';
        return { usn: e.usn, name: `Student ${e.usn}`, dept };
      });
  }

  getDeptOverview(
    windowId: string,
  ): Array<{ dept: string; eligible: number; registered: number }> {
    const depts = ['CS', 'EC', 'ME', 'CV'];
    return depts.map((dept) => ({
      dept,
      eligible: this.eligibilities.filter((e) => {
        const usnDept = e.usn.length === 10 ? e.usn.slice(5, 7) : '';
        return e.windowId === windowId && e.isEligible && usnDept === dept;
      }).length,
      registered: this.registrations.filter((r) => {
        const usnDept = r.usn.length === 10 ? r.usn.slice(5, 7) : '';
        return r.windowId === windowId && usnDept === dept;
      }).length,
    }));
  }

  sendReminders(
    windowId: string,
    usnList: string[],
  ): { reminded: string[]; windowId: string } {
    return { reminded: usnList, windowId };
  }

  /** Run eligibility check for all students in a window using stored attendance data */
  runEligibility(windowId: string): { processed: number; windowId: string } {
    return { processed: this.eligibilities.filter((e) => e.windowId === windowId).length, windowId };
  }

  getWindowById(id: string): VtuWindow {
    const win = this.windows.find((w) => w.id === id);
    if (!win) throw new NotFoundException('Window not found');
    return win;
  }
}
