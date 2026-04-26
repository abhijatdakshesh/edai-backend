import { Injectable, NotFoundException, ForbiddenException, Optional, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionBatchEntity, PromotionAuditEntity } from '../entities/promotion-batch.entity';

export interface PromotionAuditEntry {
  id: string;
  batchId: string;
  action: 'PROMOTED' | 'OVERRIDDEN';
  actorId: string;
  actorRole: string;
  reason?: string;
  overrides?: Array<{ usn: string; decision: 'PROMOTE' | 'DETAIN' }>;
  timestamp: string;
}

export interface PromotionBatch {
  id: string;
  className: string;
  fromSemester: number;
  toSemester: number;
  academicYear: string;
  dept: string;
  status: 'PENDING' | 'PROMOTED' | 'OVERRIDDEN';
  promotedAt: string | null;
  stats: { eligible: number; detained: number; conditional: number; total: number };
  createdAt: string;
}

@Injectable()
export class PromotionService implements OnModuleInit {
  constructor(
    @Optional() @InjectRepository(PromotionBatchEntity)
    private readonly batchRepo?: Repository<PromotionBatchEntity>,
    @Optional() @InjectRepository(PromotionAuditEntity)
    private readonly auditRepo?: Repository<PromotionAuditEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.batchRepo) {
      const rows = await this.batchRepo.find();
      if (rows.length > 0) {
        this.batches = rows.map((r) => ({
          id: r.id, className: r.className, fromSemester: r.fromSemester,
          toSemester: r.toSemester, academicYear: r.academicYear, dept: r.dept,
          status: r.status as PromotionBatch['status'], promotedAt: r.promotedAt,
          stats: (r.stats as PromotionBatch['stats']) ?? { eligible: 0, detained: 0, conditional: 0, total: 0 },
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        }));
      }
    }
    if (this.auditRepo) {
      const rows = await this.auditRepo.find();
      rows.forEach((r) => this.auditLog.push({
        id: r.id, batchId: r.batchId, action: r.action as PromotionAuditEntry['action'],
        actorId: r.actorId, actorRole: r.actorRole, reason: r.reason ?? undefined,
        overrides: (r.overrides as PromotionAuditEntry['overrides']) ?? undefined,
        timestamp: r.timestamp,
      }));
    }
  }

  /** Append-only audit log — never delete or update entries */
  readonly auditLog: PromotionAuditEntry[] = [];

  batches: PromotionBatch[] = [
    {
      id: 'promo-1',
      className: 'CSE-A Sem 5',
      fromSemester: 5,
      toSemester: 6,
      academicYear: '2025-26',
      dept: 'CSE',
      status: 'PENDING',
      promotedAt: null,
      stats: { eligible: 55, detained: 5, conditional: 2, total: 60 },
      createdAt: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'promo-2',
      className: 'ECE-A Sem 5',
      fromSemester: 5,
      toSemester: 6,
      academicYear: '2025-26',
      dept: 'ECE',
      status: 'PROMOTED',
      promotedAt: '2026-04-10T00:00:00.000Z',
      stats: { eligible: 56, detained: 2, conditional: 0, total: 58 },
      createdAt: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'promo-3',
      className: 'ME-B Sem 3',
      fromSemester: 3,
      toSemester: 4,
      academicYear: '2025-26',
      dept: 'ME',
      status: 'PENDING',
      promotedAt: null,
      stats: { eligible: 40, detained: 5, conditional: 3, total: 45 },
      createdAt: '2026-04-02T00:00:00.000Z',
    },
  ];

  getBatches(): PromotionBatch[] {
    return this.batches;
  }

  getBatchById(id: string): PromotionBatch {
    const batch = this.batches.find((b) => b.id === id);
    if (!batch) throw new NotFoundException('Promotion batch not found');
    return batch;
  }

  getDetentionList(
    dept?: string,
    semester?: number,
  ): Array<{ usn: string; name: string; dept: string; semester: number; attendancePct: number; cgpa: number; reason: string }> {
    const stubs = [
      { usn: '1RV21CS010', name: 'Rahul Verma', dept: 'CSE', semester: 5, attendancePct: 68, cgpa: 5.2, reason: 'Attendance below 75%' },
      { usn: '1RV21CS011', name: 'Anjali Singh', dept: 'CSE', semester: 5, attendancePct: 72, cgpa: 4.8, reason: 'CGPA below 5.0' },
      { usn: '1RV21EC005', name: 'Mohan Das', dept: 'ECE', semester: 5, attendancePct: 65, cgpa: 5.5, reason: 'Attendance below 75%' },
      { usn: '1RV21ME008', name: 'Suresh Patil', dept: 'ME', semester: 3, attendancePct: 60, cgpa: 4.5, reason: 'Attendance and CGPA both below threshold' },
    ];
    let filtered = stubs;
    if (dept) filtered = filtered.filter((s) => s.dept === dept);
    if (semester) filtered = filtered.filter((s) => s.semester === semester);
    return filtered;
  }

  private currentAcademicYear(): string {
    const now = new Date();
    const y = now.getFullYear();
    // Academic year starts in June
    return now.getMonth() >= 5 ? `${y}-${(y + 1).toString().slice(2)}` : `${y - 1}-${y.toString().slice(2)}`;
  }

  generate(
    semester: number,
    dept: string,
    stats?: { eligible: number; detained: number; conditional: number; total: number },
  ): PromotionBatch {
    if (semester < 1) throw new Error('Semester must be at least 1');
    if (semester >= 8) throw new Error('Semester cannot exceed 8 for a 4-year program');
    const batch: PromotionBatch = {
      id: `promo-${Date.now()}`,
      className: `${dept} Sem ${semester}`,
      fromSemester: semester,
      toSemester: semester + 1,
      academicYear: this.currentAcademicYear(),
      dept,
      status: 'PENDING',
      promotedAt: null,
      stats: stats ?? { eligible: 0, detained: 0, conditional: 0, total: 0 },
      createdAt: new Date().toISOString(),
    };
    this.batches.push(batch);
    this.batchRepo?.save(batch as unknown as PromotionBatchEntity)
      .catch((e) => console.error('DB persist error (generate)', e));
    return batch;
  }

  async promote(
    batchId: string,
    actor?: { id: string; role: string },
  ): Promise<{ ok: true; batchId: string; promotedAt: string }> {
    const batch = this.getBatchById(batchId);
    const promotedAt = new Date().toISOString();
    batch.status = 'PROMOTED';
    batch.promotedAt = promotedAt;
    const auditEntry: PromotionAuditEntry = {
      id: `audit-${Date.now()}`,
      batchId,
      action: 'PROMOTED',
      actorId: actor?.id ?? 'system',
      actorRole: actor?.role ?? 'SYSTEM',
      timestamp: promotedAt,
    };
    this.auditLog.push(auditEntry);
    if (this.batchRepo && this.auditRepo) {
      await this.batchRepo.manager.transaction(async (manager) => {
        await manager.save(PromotionBatchEntity, batch as unknown as PromotionBatchEntity);
        await manager.save(PromotionAuditEntity, auditEntry as unknown as PromotionAuditEntity);
      });
    }
    return { ok: true, batchId, promotedAt };
  }

  async override(
    batchId: string,
    overrides: Array<{ usn: string; decision: 'PROMOTE' | 'DETAIN' }>,
    actor?: { id: string; role: string; reason?: string },
  ): Promise<{ ok: true; overrideCount: number }> {
    const batch = this.getBatchById(batchId);
    batch.status = 'OVERRIDDEN';
    const overrideAudit: PromotionAuditEntry = {
      id: `audit-${Date.now()}`,
      batchId,
      action: 'OVERRIDDEN',
      actorId: actor?.id ?? 'system',
      actorRole: actor?.role ?? 'SYSTEM',
      reason: actor?.reason,
      overrides,
      timestamp: new Date().toISOString(),
    };
    this.auditLog.push(overrideAudit);
    if (this.batchRepo && this.auditRepo) {
      await this.batchRepo.manager.transaction(async (manager) => {
        await manager.save(PromotionBatchEntity, batch as unknown as PromotionBatchEntity);
        await manager.save(PromotionAuditEntity, overrideAudit as unknown as PromotionAuditEntity);
      });
    }
    return { ok: true, overrideCount: overrides.length };
  }

  /**
   * Get audit log for a batch — readable by PRINCIPAL/ADMIN/TRUSTEE only.
   * Caller must enforce role check before calling this method.
   */
  getAuditLog(batchId?: string): PromotionAuditEntry[] {
    if (batchId) return this.auditLog.filter((e) => e.batchId === batchId);
    return [...this.auditLog];
  }
}
