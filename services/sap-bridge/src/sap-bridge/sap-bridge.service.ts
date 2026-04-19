import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type SyncJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'DLQ';
export type SyncJobType = 'ATTENDANCE_SYNC' | 'FEE_WRITEBACK' | 'STUDENT_MASTER_PULL' | 'MARKS_EXPORT';

export interface SyncJob {
  id: string;
  type: SyncJobType;
  status: SyncJobStatus;
  payload: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
  scheduledAt: string;
  completedAt?: string;
}

@Injectable()
export class SapBridgeService {
  private readonly logger = new Logger(SapBridgeService.name);
  private readonly jobs: SyncJob[] = [];

  enqueue(type: SyncJobType, payload: Record<string, unknown>): SyncJob {
    const job: SyncJob = {
      id: randomUUID(),
      type,
      status: 'QUEUED',
      payload,
      attemptCount: 0,
      maxAttempts: 3,
      scheduledAt: new Date().toISOString(),
    };
    this.jobs.push(job);
    this.logger.log(`SAP sync job enqueued: type=${type} id=${job.id}`);
    void this.executeJob(job);
    return job;
  }

  private async executeJob(job: SyncJob): Promise<void> {
    job.status = 'RUNNING';
    job.attemptCount += 1;

    try {
      this.logger.log(`Executing SAP job ${job.id} (attempt ${job.attemptCount})`);
      // Production: call SAP OData / IDoc / BAPI endpoint here
      // const response = await fetch(`${SAP_ODATA_URL}/...`, { method: 'POST', body: JSON.stringify(job.payload) });
      job.status = 'SUCCESS';
      job.completedAt = new Date().toISOString();
    } catch (err) {
      job.lastError = String(err);
      if (job.attemptCount >= job.maxAttempts) {
        job.status = 'DLQ';
        this.logger.error(`SAP job moved to DLQ: id=${job.id} error=${job.lastError}`);
      } else {
        job.status = 'QUEUED';
        // Production: re-enqueue with exponential backoff
      }
    }
  }

  listJobs(status?: SyncJobStatus): SyncJob[] {
    return status ? this.jobs.filter((j) => j.status === status) : this.jobs;
  }

  retryDlq(): { retried: number } {
    const dlqJobs = this.jobs.filter((j) => j.status === 'DLQ');
    for (const job of dlqJobs) {
      job.status = 'QUEUED';
      job.attemptCount = 0;
      void this.executeJob(job);
    }
    return { retried: dlqJobs.length };
  }

  odataQuery(entity: string, filter?: string): Record<string, unknown> {
    this.logger.log(`OData query: entity=${entity} filter=${filter}`);
    return {
      entity,
      filter: filter ?? 'none',
      result: [],
      note: 'Production: proxy to SAP OData service at SAP_ODATA_URL',
    };
  }
}
