import { Injectable, NotFoundException } from '@nestjs/common';

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
}

@Injectable()
export class VtuService {
  windows: VtuWindow[] = [];
  registrations: VtuRegistration[] = [];
  eligibilities: VtuEligibility[] = [];

  getAllWindows(): VtuWindow[] {
    return this.windows;
  }

  getActiveWindow(): VtuWindow | null {
    return this.windows.find((w) => w.isActive) ?? null;
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
    const existing = this.registrations.find(
      (r) => r.windowId === windowId && r.usn === usn,
    );
    if (existing) {
      existing.subjectCodes = subjectCodes;
      existing.registeredAt = new Date().toISOString();
      return existing;
    }
    const reg: VtuRegistration = {
      windowId,
      usn,
      subjectCodes,
      registeredAt: new Date().toISOString(),
    };
    this.registrations.push(reg);
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
      .map((e) => ({ usn: e.usn, name: `Student ${e.usn}`, dept: 'CS' }));
  }

  getDeptOverview(
    windowId: string,
  ): Array<{ dept: string; eligible: number; registered: number }> {
    const depts = ['CS', 'EC', 'ME', 'CV'];
    return depts.map((dept) => ({
      dept,
      eligible: this.eligibilities.filter((e) => e.windowId === windowId).length,
      registered: this.registrations.filter((r) => r.windowId === windowId).length,
    }));
  }

  sendReminders(
    windowId: string,
    usnList: string[],
  ): { reminded: string[]; windowId: string } {
    return { reminded: usnList, windowId };
  }

  runEligibility(windowId: string): { processed: number; windowId: string } {
    return { processed: this.eligibilities.filter((e) => e.windowId === windowId).length, windowId };
  }
}
