import { Injectable, NotFoundException } from '@nestjs/common';

export interface IAEntry {
  usn: string;
  name: string;
  ia1: number;
  ia2: number;
  ia3: number;
  subjectCode: string;
  sem: number;
}

export interface IASubmission {
  id: string;
  teacherId: string;
  subjectCode: string;
  sem: number;
  submittedAt: string;
  status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED';
}

@Injectable()
export class IaService {
  entries: IAEntry[] = [];
  submissions: IASubmission[] = [];

  getMarks(subjectCode: string, sem: number): IAEntry[] {
    return this.entries.filter(
      (e) => e.subjectCode === subjectCode && e.sem === sem,
    );
  }

  saveMarks(
    subjectCode: string,
    sem: number,
    marks: Array<{ usn: string; ia1: number; ia2: number; ia3: number }>,
    teacherId: string,
  ): IASubmission {
    for (const m of marks) {
      const existing = this.entries.find(
        (e) => e.usn === m.usn && e.subjectCode === subjectCode && e.sem === sem,
      );
      if (existing) {
        existing.ia1 = m.ia1;
        existing.ia2 = m.ia2;
        existing.ia3 = m.ia3;
      } else {
        this.entries.push({
          usn: m.usn,
          name: `Student ${m.usn}`,
          subjectCode,
          sem,
          ia1: m.ia1,
          ia2: m.ia2,
          ia3: m.ia3,
        });
      }
    }

    const existing = this.submissions.find(
      (s) =>
        s.teacherId === teacherId &&
        s.subjectCode === subjectCode &&
        s.sem === sem,
    );
    if (existing) {
      existing.submittedAt = new Date().toISOString();
      return existing;
    }
    const sub: IASubmission = {
      id: `ia-sub-${Date.now()}`,
      teacherId,
      subjectCode,
      sem,
      submittedAt: new Date().toISOString(),
      status: 'DRAFT',
    };
    this.submissions.push(sub);
    return sub;
  }

  submitForReview(subjectCode: string, sem: number, teacherId: string): IASubmission {
    const sub = this.submissions.find(
      (s) =>
        s.teacherId === teacherId &&
        s.subjectCode === subjectCode &&
        s.sem === sem,
    );
    if (!sub) throw new NotFoundException('Submission not found');
    sub.status = 'SUBMITTED';
    sub.submittedAt = new Date().toISOString();
    return sub;
  }

  getAllSubmissions(): IASubmission[] {
    return this.submissions;
  }

  confirm(id: string): IASubmission {
    const sub = this.submissions.find((s) => s.id === id);
    if (!sub) throw new NotFoundException('Submission not found');
    sub.status = 'CONFIRMED';
    return sub;
  }

  sendReminders(teacherIds: string[]): { reminded: string[] } {
    return { reminded: teacherIds };
  }

  uploadResults(subjectCode: string, sem: number): { message: string } {
    return { message: `Results for ${subjectCode} sem ${sem} queued for upload` };
  }

  getMarksBySubject(subjectId: string): IAEntry[] {
    return this.entries.filter((e) => e.subjectCode === subjectId);
  }
}
