import { Injectable, NotFoundException } from '@nestjs/common';

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
export class PromotionService {
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
    return batch;
  }

  promote(batchId: string): { ok: true; batchId: string; promotedAt: string } {
    const batch = this.getBatchById(batchId);
    batch.status = 'PROMOTED';
    return { ok: true, batchId, promotedAt: new Date().toISOString() };
  }

  override(
    batchId: string,
    overrides: Array<{ usn: string; decision: 'PROMOTE' | 'DETAIN' }>,
  ): { ok: true; overrideCount: number } {
    const batch = this.getBatchById(batchId);
    batch.status = 'OVERRIDDEN';
    return { ok: true, overrideCount: overrides.length };
  }
}
