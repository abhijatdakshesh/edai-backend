import { Injectable, NotFoundException, Optional, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlumniOutcomeEntity } from '../entities/placement.entity';

export interface Job {
  id: string;
  company: string;
  role: string;
  package: string;
  deadline: string;
  eligibility: string;
  applyUrl: string;
  dept?: string;
}

export interface JobApplication {
  jobId: string;
  usn: string;
  appliedAt: string;
}

export interface PlacementPrediction {
  usn: string;
  name: string;
  likelihood: 'HIGH' | 'MEDIUM' | 'LOW';
  skillGaps: string[];
  dept: string;
}

export interface PlacementDrive {
  id: string;
  company: string;
  scheduledDate: string;
  venue: string;
  rounds: string[];
  eligibleDepts: string[];
  minCgpa: number;
  status: 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  offersExtended: number;
}

export interface AlumniOutcome {
  usn: string;
  name: string;
  graduationYear: number;
  company: string;
  role: string;
  packageLpa: number;
  dept: string;
  location: string;
}

export interface PlacementStats {
  academicYear: string;
  dept: string;
  totalStudents: number;
  placed: number;
  placementPct: number;
  avgPackageLpa: number;
  highestPackageLpa: number;
  companiesVisited: number;
  offersExtended: number;
}

export interface SkillGapReport {
  usn: string;
  name: string;
  dept: string;
  cgpa: number;
  placementScore: number;
  missingSkills: string[];
  recommendedCourses: string[];
}

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @Optional() @InjectRepository(AlumniOutcomeEntity)
    private readonly alumniRepo?: Repository<AlumniOutcomeEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.alumniRepo) {
      const rows = await this.alumniRepo.find();
      this.alumni = rows.map((r) => ({
        usn: r.usn, name: r.name, graduationYear: r.graduationYear, company: r.company,
        role: r.role, packageLpa: Number(r.packageLpa), dept: r.dept, location: r.location,
      }));
    }
  }

  jobs: Job[] = [];
  applications: JobApplication[] = [];
  predictions: PlacementPrediction[] = [];
  drives: PlacementDrive[] = [];
  alumni: AlumniOutcome[] = [];

  // ─── Existing job board ───────────────────────────────────────────────────

  getJobs(): Job[] {
    return this.jobs;
  }

  getJob(id: string): Job {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  apply(jobId: string, usn: string): { message: string } {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) throw new NotFoundException('Job not found');
    const existing = this.applications.find((a) => a.jobId === jobId && a.usn === usn);
    if (!existing) {
      this.applications.push({ jobId, usn, appliedAt: new Date().toISOString() });
    }
    return { message: 'Application submitted' };
  }

  getMyApplications(
    usn: string,
  ): Array<{ id: string; jobId: string; companyName: string; role: string; status: 'APPLIED' | 'SHORTLISTED' | 'REJECTED'; appliedAt: string }> {
    return this.applications
      .filter((a) => a.usn === usn)
      .map((a) => {
        const job = this.jobs.find((j) => j.id === a.jobId);
        return {
          id: `app-${a.jobId}-${usn}`,
          jobId: a.jobId,
          companyName: job?.company ?? 'Unknown',
          role: job?.role ?? 'Unknown',
          status: 'APPLIED' as const,
          appliedAt: a.appliedAt,
        };
      });
  }

  withdraw(_applicationId: string): { ok: true } {
    return { ok: true };
  }

  getPredictions(dept?: string, likelihood?: string): PlacementPrediction[] {
    let results = this.predictions;
    if (dept) results = results.filter((p) => p.dept === dept);
    if (likelihood) results = results.filter((p) => p.likelihood === likelihood);
    return results;
  }

  // ─── Placement Intelligence SKU ───────────────────────────────────────────

  /** Placement drives — CRM for company visits */
  getDrives(status?: string): PlacementDrive[] {
    if (!status) return this.drives;
    return this.drives.filter((d) => d.status === status.toUpperCase());
  }

  getDrive(id: string): PlacementDrive {
    const drive = this.drives.find((d) => d.id === id);
    if (!drive) throw new NotFoundException(`Drive ${id} not found`);
    return drive;
  }

  createDrive(payload: Omit<PlacementDrive, 'id' | 'offersExtended'>): PlacementDrive {
    const drive: PlacementDrive = {
      ...payload,
      id: `drive-${Date.now()}`,
      offersExtended: 0,
    };
    this.drives.push(drive);
    return drive;
  }

  completeDrive(id: string, offersExtended: number): PlacementDrive {
    const drive = this.getDrive(id);
    drive.status = 'COMPLETED';
    drive.offersExtended = offersExtended;
    return drive;
  }

  /** Alumni outcome tracking */
  getAlumniOutcomes(dept?: string, graduationYear?: number): AlumniOutcome[] {
    let results = this.alumni;
    if (dept) results = results.filter((a) => a.dept === dept);
    if (graduationYear) results = results.filter((a) => a.graduationYear === graduationYear);
    return results;
  }

  addAlumniOutcome(outcome: AlumniOutcome): AlumniOutcome {
    this.alumni.push(outcome);
    this.alumniRepo?.save(outcome as unknown as AlumniOutcomeEntity)
      .catch((e) => console.error('DB persist error (addAlumniOutcome)', e));
    return outcome;
  }

  /** Placement statistics by dept + academic year */
  getPlacementStats(dept?: string, academicYear?: string): PlacementStats[] {
    const stub: PlacementStats[] = [
      { academicYear: '2024-25', dept: 'CSE', totalStudents: 120, placed: 108, placementPct: 90, avgPackageLpa: 12.4, highestPackageLpa: 45, companiesVisited: 38, offersExtended: 125 },
      { academicYear: '2024-25', dept: 'ECE', totalStudents: 60,  placed: 52,  placementPct: 87, avgPackageLpa: 9.8,  highestPackageLpa: 28, companiesVisited: 22, offersExtended: 60 },
      { academicYear: '2024-25', dept: 'ME',  totalStudents: 60,  placed: 48,  placementPct: 80, avgPackageLpa: 7.2,  highestPackageLpa: 18, companiesVisited: 18, offersExtended: 52 },
      { academicYear: '2024-25', dept: 'ISE', totalStudents: 60,  placed: 55,  placementPct: 92, avgPackageLpa: 11.8, highestPackageLpa: 40, companiesVisited: 30, offersExtended: 62 },
      { academicYear: '2023-24', dept: 'CSE', totalStudents: 120, placed: 112, placementPct: 93, avgPackageLpa: 11.2, highestPackageLpa: 42, companiesVisited: 40, offersExtended: 130 },
    ];
    let results = stub;
    if (dept) results = results.filter((s) => s.dept === dept);
    if (academicYear) results = results.filter((s) => s.academicYear === academicYear);
    return results;
  }

  /** Skill gap report — who needs upskilling before placement season */
  getSkillGapReport(dept?: string): SkillGapReport[] {
    const base: SkillGapReport[] = [
      { usn: '1RV21CS001', name: 'Arjun Kumar',  dept: 'CSE', cgpa: 8.2, placementScore: 82, missingSkills: ['System Design', 'SQL optimization'], recommendedCourses: ['DBMS Advanced', 'LLD Course'] },
      { usn: '1RV21CS002', name: 'Sneha Reddy',  dept: 'CSE', cgpa: 7.9, placementScore: 75, missingSkills: ['DSA — Trees & Graphs'], recommendedCourses: ['Competitive Programming'] },
      { usn: '1RV21CS005', name: 'Ravi Kumar',   dept: 'CSE', cgpa: 5.9, placementScore: 44, missingSkills: ['Core Java', 'DSA', 'Communication'], recommendedCourses: ['Java Fundamentals', 'Aptitude & Verbal'] },
      { usn: '1RV21EC005', name: 'Mohan Das',    dept: 'ECE', cgpa: 5.5, placementScore: 38, missingSkills: ['Embedded C', 'VLSI basics'], recommendedCourses: ['Embedded Systems', 'Digital Circuits'] },
    ];
    if (dept) return base.filter((r) => r.dept === dept);
    return base;
  }

  /** Overall placement summary for admin dashboard */
  getPlacementSummary(): {
    currentYear: string;
    totalEligible: number;
    placed: number;
    placementPct: number;
    avgPackageLpa: number;
    highestPackageLpa: number;
    topRecruiter: string;
    drivesScheduled: number;
    offersExtended: number;
  } {
    const stats = this.getPlacementStats(undefined, '2024-25');
    const totalEligible = stats.reduce((s, r) => s + r.totalStudents, 0);
    const placed = stats.reduce((s, r) => s + r.placed, 0);
    const offersExtended = stats.reduce((s, r) => s + r.offersExtended, 0);
    const avgPkg = stats.length > 0 ? stats.reduce((s, r) => s + r.avgPackageLpa, 0) / stats.length : 0;
    const highestPkg = stats.length > 0 ? Math.max(...stats.map((r) => r.highestPackageLpa)) : 0;
    return {
      currentYear: '2024-25',
      totalEligible,
      placed,
      placementPct: totalEligible > 0 ? Math.round((placed / totalEligible) * 100) : 0,
      avgPackageLpa: Math.round(avgPkg * 10) / 10,
      highestPackageLpa: highestPkg,
      topRecruiter: 'Microsoft',
      drivesScheduled: this.drives.length,
      offersExtended,
    };
  }
}
