import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Scholarship,
  StudentScholarship,
  EligibilityCriteria,
} from '../entities/fee.entity';

@Injectable()
export class ScholarshipsService {
  private readonly logger = new Logger(ScholarshipsService.name);
  private scholarships: Scholarship[] = [];
  private studentScholarships: StudentScholarship[] = [];

  createScholarship(data: Omit<Scholarship, 'id'>): Scholarship {
    const s: Scholarship = { id: randomUUID(), ...data };
    this.scholarships.push(s);
    return s;
  }

  getEligibleStudents(scholarshipId?: string): StudentScholarship[] {
    return this.studentScholarships.filter(
      (ss) =>
        ss.status === 'ELIGIBLE' &&
        (!scholarshipId || ss.scholarshipId === scholarshipId),
    );
  }

  apply(studentId: string, scholarshipId: string): StudentScholarship | null {
    const ss = this.studentScholarships.find(
      (s) => s.studentId === studentId && s.scholarshipId === scholarshipId,
    );
    if (!ss) return null;
    if (ss.status !== 'ELIGIBLE') return ss;
    ss.status = 'APPLIED';
    ss.appliedAt = new Date();
    return ss;
  }

  /**
   * Daily discovery cron: checks each student against scholarship criteria.
   * In production: query from academics + attendance services.
   */
  async runDiscovery(studentProfiles: Array<{ studentId: string; gpa: number; attendance: number }>): Promise<void> {
    for (const scholarship of this.scholarships.filter((s) => s.isActive)) {
      const { minGpa, attendanceMin } = scholarship.eligibilityCriteria;
      for (const profile of studentProfiles) {
        if (minGpa && profile.gpa < minGpa) continue;
        if (attendanceMin && profile.attendance < attendanceMin) continue;

        const already = this.studentScholarships.find(
          (ss) => ss.studentId === profile.studentId && ss.scholarshipId === scholarship.id,
        );
        if (already) continue;

        const ss: StudentScholarship = {
          id: randomUUID(),
          studentId: profile.studentId,
          scholarshipId: scholarship.id,
          status: 'ELIGIBLE',
          detectedAt: new Date(),
        };
        this.studentScholarships.push(ss);
        // KAFKA: emit comms.scholarship.eligible → notifications service sends push + WhatsApp
        this.logger.log('Scholarship %s: student %s is now eligible', scholarship.name, profile.studentId);
      }
    }
  }
}
