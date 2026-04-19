import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type DriveStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type ApplicationStatus = 'APPLIED' | 'SHORTLISTED' | 'SELECTED' | 'REJECTED';

export interface PlacementDrive {
  id: string;
  companyName: string;
  role: string;
  ctcLpa: number;
  eligibilityCgpa: number;
  scheduledAt: string;
  status: DriveStatus;
  institutionId: string;
  createdAt: string;
}

export interface Application {
  id: string;
  driveId: string;
  studentId: string;
  status: ApplicationStatus;
  appliedAt: string;
}

@Injectable()
export class PlacementsService {
  private readonly drives: PlacementDrive[] = [];
  private readonly applications: Application[] = [];

  createDrive(data: Omit<PlacementDrive, 'id' | 'createdAt' | 'status'>): PlacementDrive {
    const drive: PlacementDrive = { ...data, id: randomUUID(), status: 'UPCOMING', createdAt: new Date().toISOString() };
    this.drives.push(drive);
    return drive;
  }

  apply(driveId: string, studentId: string): Application {
    const drive = this.drives.find((d) => d.id === driveId);
    if (!drive) throw new NotFoundException('Drive not found');
    const app: Application = { id: randomUUID(), driveId, studentId, status: 'APPLIED', appliedAt: new Date().toISOString() };
    this.applications.push(app);
    return app;
  }

  updateApplicationStatus(applicationId: string, status: ApplicationStatus): Application {
    const app = this.applications.find((a) => a.id === applicationId);
    if (!app) throw new NotFoundException('Application not found');
    app.status = status;
    return app;
  }

  listDrives(institutionId: string): PlacementDrive[] {
    return this.drives.filter((d) => d.institutionId === institutionId);
  }

  studentApplications(studentId: string): Application[] {
    return this.applications.filter((a) => a.studentId === studentId);
  }
}
