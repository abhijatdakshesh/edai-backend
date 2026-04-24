import { Injectable, NotFoundException } from '@nestjs/common';

export interface PromotionBatch {
  id: string;
  semester: number;
  dept: string;
  status: 'PENDING' | 'PROMOTED' | 'OVERRIDDEN';
  totalStudents: number;
  eligible: number;
  detained: number;
  createdAt: string;
}

@Injectable()
export class PromotionService {
  batches: PromotionBatch[] = [
    {
      id: 'promo-1',
      semester: 5,
      dept: 'CSE',
      status: 'PENDING',
      totalStudents: 60,
      eligible: 55,
      detained: 5,
      createdAt: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'promo-2',
      semester: 5,
      dept: 'ECE',
      status: 'PROMOTED',
      totalStudents: 58,
      eligible: 56,
      detained: 2,
      createdAt: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'promo-3',
      semester: 3,
      dept: 'ME',
      status: 'PENDING',
      totalStudents: 45,
      eligible: 40,
      detained: 5,
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

  generate(
    semester: number,
    dept: string,
  ): PromotionBatch {
    const batch: PromotionBatch = {
      id: `promo-${Date.now()}`,
      semester,
      dept,
      status: 'PENDING',
      totalStudents: 60,
      eligible: 55,
      detained: 5,
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
