import { Injectable, NotFoundException } from '@nestjs/common';

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

@Injectable()
export class JobsService {
  jobs: Job[] = [];
  applications: JobApplication[] = [];
  predictions: PlacementPrediction[] = [];

  getJobs(): Job[] {
    return this.jobs;
  }

  apply(jobId: string, usn: string): { message: string } {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) throw new NotFoundException('Job not found');
    const existing = this.applications.find(
      (a) => a.jobId === jobId && a.usn === usn,
    );
    if (!existing) {
      this.applications.push({ jobId, usn, appliedAt: new Date().toISOString() });
    }
    return { message: 'Application submitted' };
  }

  getPredictions(dept?: string, likelihood?: string): PlacementPrediction[] {
    let results = this.predictions;
    if (dept) results = results.filter((p) => p.dept === dept);
    if (likelihood) results = results.filter((p) => p.likelihood === likelihood);
    return results;
  }

  getJob(id: string): Job {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) throw new NotFoundException('Job not found');
    return job;
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

  withdraw(applicationId: string): { ok: true } {
    return { ok: true };
  }
}
