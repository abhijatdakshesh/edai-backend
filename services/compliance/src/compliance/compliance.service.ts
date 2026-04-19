import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type ReportType = 'NAAC' | 'NBA' | 'UGC' | 'IQAC';
export type ReportStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SUBMITTED';

export interface EvidenceItem {
  id: string;
  criterionId: string;
  title: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ComplianceReport {
  id: string;
  type: ReportType;
  institutionId: string;
  academicYear: string;
  status: ReportStatus;
  evidenceItems: EvidenceItem[];
  generatedAt?: string;
  createdAt: string;
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);
  private readonly reports: ComplianceReport[] = [];

  create(type: ReportType, institutionId: string, academicYear: string): ComplianceReport {
    const report: ComplianceReport = {
      id: randomUUID(),
      type,
      institutionId,
      academicYear,
      status: 'DRAFT',
      evidenceItems: [],
      createdAt: new Date().toISOString(),
    };
    this.reports.push(report);
    return report;
  }

  addEvidence(reportId: string, item: Omit<EvidenceItem, 'id' | 'uploadedAt'>): EvidenceItem {
    const report = this.findById(reportId);
    const evidence: EvidenceItem = { ...item, id: randomUUID(), uploadedAt: new Date().toISOString() };
    report.evidenceItems.push(evidence);
    return evidence;
  }

  generate(reportId: string): ComplianceReport {
    const report = this.findById(reportId);
    report.generatedAt = new Date().toISOString();
    report.status = 'IN_REVIEW';
    this.logger.log(`Report generated: id=${reportId} type=${report.type}`);
    return report;
  }

  approve(reportId: string): ComplianceReport {
    const report = this.findById(reportId);
    report.status = 'APPROVED';
    return report;
  }

  submit(reportId: string): ComplianceReport {
    const report = this.findById(reportId);
    report.status = 'SUBMITTED';
    return report;
  }

  list(institutionId: string): ComplianceReport[] {
    return this.reports.filter((r) => r.institutionId === institutionId);
  }

  findById(id: string): ComplianceReport {
    const report = this.reports.find((r) => r.id === id);
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }
}
