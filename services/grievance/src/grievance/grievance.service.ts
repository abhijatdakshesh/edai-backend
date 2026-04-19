import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type GrievancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type GrievanceStatus = 'FILED' | 'ACKNOWLEDGED' | 'IN_REVIEW' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';

export interface Grievance {
  id: string;
  filedBy: string;
  category: string;
  description: string;
  priority: GrievancePriority;
  status: GrievanceStatus;
  assignedTo?: string;
  resolution?: string;
  auditLog: Array<{ action: string; by: string; at: string }>;
  filedAt: string;
  updatedAt: string;
}

@Injectable()
export class GrievanceService {
  private readonly logger = new Logger(GrievanceService.name);
  private readonly grievances: Grievance[] = [];

  file(filedBy: string, category: string, description: string, priority: GrievancePriority): Grievance {
    const g: Grievance = {
      id: randomUUID(),
      filedBy,
      category,
      description,
      priority,
      status: 'FILED',
      auditLog: [{ action: 'FILED', by: filedBy, at: new Date().toISOString() }],
      filedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.grievances.push(g);
    this.logger.log(`GrievanceFiled: id=${g.id} category=${category} priority=${priority}`);
    // Production: emit GrievanceFiled Kafka event here
    return g;
  }

  transition(id: string, status: GrievanceStatus, by: string, resolution?: string): Grievance {
    const g = this.grievances.find((x) => x.id === id);
    if (!g) throw new NotFoundException('Grievance not found');
    g.status = status;
    if (resolution) g.resolution = resolution;
    g.updatedAt = new Date().toISOString();
    g.auditLog.push({ action: status, by, at: new Date().toISOString() });
    return g;
  }

  list(status?: GrievanceStatus): Grievance[] {
    return status ? this.grievances.filter((g) => g.status === status) : this.grievances;
  }

  byId(id: string): Grievance {
    const g = this.grievances.find((x) => x.id === id);
    if (!g) throw new NotFoundException('Grievance not found');
    return g;
  }
}
