/**
 * PromotionService
 *
 * Handles student promotion from one semester to the next.
 *
 * Promotion criteria (configurable per institution):
 *   1. Attendance >= 75% in ALL subjects
 *   2. Internal Assessment marks >= minimum passing threshold
 *   3. Fee clearance (no outstanding dues)
 *   4. No active disciplinary hold
 *
 * Flow:
 *   1. HOD/Admin triggers "Generate Eligibility Report" for a class
 *   2. System evaluates each student against all criteria
 *   3. Result: ELIGIBLE | DETAINED | CONDITIONAL (e.g. medical exemption approved)
 *   4. Admin reviews, overrides if needed, then runs "Batch Promote"
 *   5. Batch promote updates student's current semester in identity/academics service
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type PromotionStatus = 'ELIGIBLE' | 'DETAINED' | 'CONDITIONAL' | 'PROMOTED';

export interface PromotionCriteria {
  minAttendancePct: number; // default 75
  minIaScore: number; // default 40 out of 100
  feeClearanceRequired: boolean;
}

export interface StudentEligibility {
  studentUsn: string;
  studentName: string;
  currentSemester: number;
  targetSemester: number;
  attendancePct: number; // overall across subjects
  iaScore: number; // avg IA score
  feeCleared: boolean;
  status: PromotionStatus;
  failedCriteria: string[]; // e.g. ["ATTENDANCE_LOW", "FEE_PENDING"]
  overrideNote?: string;
  overriddenBy?: string;
}

export interface PromotionBatch {
  id: string;
  classId: string;
  className: string;
  fromSemester: number;
  toSemester: number;
  academicYear: string;
  generatedAt: string;
  promotedAt?: string;
  promotedBy?: string;
  criteria: PromotionCriteria;
  students: StudentEligibility[];
  stats: {
    total: number;
    eligible: number;
    detained: number;
    conditional: number;
    promoted: number;
  };
}

// In-memory store (replace with TypeORM in Phase 2)
const BATCHES: PromotionBatch[] = [];

// Mock student data — in production fetched from identity + attendance + marks + fees services
const MOCK_STUDENT_DATA: StudentEligibility[] = [
  {
    studentUsn: '1RV21CS001', studentName: 'Priya Sharma',
    currentSemester: 5, targetSemester: 6,
    attendancePct: 88, iaScore: 72, feeCleared: true,
    status: 'ELIGIBLE', failedCriteria: [],
  },
  {
    studentUsn: '1RV21CS002', studentName: 'Arjun Reddy',
    currentSemester: 5, targetSemester: 6,
    attendancePct: 68, iaScore: 55, feeCleared: true,
    status: 'DETAINED', failedCriteria: ['ATTENDANCE_LOW'],
  },
  {
    studentUsn: '1RV21CS003', studentName: 'Bhavana Rao',
    currentSemester: 5, targetSemester: 6,
    attendancePct: 82, iaScore: 65, feeCleared: false,
    status: 'DETAINED', failedCriteria: ['FEE_PENDING'],
  },
  {
    studentUsn: '1RV21CS004', studentName: 'Chetan Kumar',
    currentSemester: 5, targetSemester: 6,
    attendancePct: 76, iaScore: 58, feeCleared: true,
    status: 'ELIGIBLE', failedCriteria: [],
  },
  {
    studentUsn: '1RV21CS005', studentName: 'Deepa Nair',
    currentSemester: 5, targetSemester: 6,
    attendancePct: 71, iaScore: 62, feeCleared: true,
    status: 'CONDITIONAL', failedCriteria: ['ATTENDANCE_LOW'],
    overrideNote: 'Medical exemption approved by HOD',
  },
  {
    studentUsn: '1RV21CS006', studentName: 'Eshan Mehta',
    currentSemester: 5, targetSemester: 6,
    attendancePct: 91, iaScore: 80, feeCleared: true,
    status: 'ELIGIBLE', failedCriteria: [],
  },
  {
    studentUsn: '1RV21CS007', studentName: 'Farhan Sheikh',
    currentSemester: 5, targetSemester: 6,
    attendancePct: 52, iaScore: 34, feeCleared: false,
    status: 'DETAINED', failedCriteria: ['ATTENDANCE_LOW', 'IA_BELOW_MIN', 'FEE_PENDING'],
  },
  {
    studentUsn: '1RV21CS008', studentName: 'Gowri Krishnan',
    currentSemester: 5, targetSemester: 6,
    attendancePct: 79, iaScore: 68, feeCleared: true,
    status: 'ELIGIBLE', failedCriteria: [],
  },
];

@Injectable()
export class PromotionService {
  /**
   * GET /api/promotion/batches — list all batches
   */
  findAll(): PromotionBatch[] {
    return BATCHES;
  }

  /**
   * GET /api/promotion/batches/:id
   */
  findById(id: string): PromotionBatch {
    const batch = BATCHES.find((b) => b.id === id);
    if (!batch) throw new NotFoundException(`Promotion batch ${id} not found`);
    return batch;
  }

  /**
   * POST /api/promotion/generate
   * Generate eligibility report for a class.
   * In production: fetches attendance from attendance service,
   * marks from academics service, fees from fees service.
   */
  generateEligibilityReport(dto: {
    classId: string;
    className: string;
    fromSemester: number;
    academicYear: string;
    criteria?: Partial<PromotionCriteria>;
  }): PromotionBatch {
    // Check if a batch already exists for this class+semester
    const existing = BATCHES.find(
      (b) => b.classId === dto.classId && b.fromSemester === dto.fromSemester && !b.promotedAt,
    );
    if (existing) {
      throw new BadRequestException(
        `A promotion batch already exists for ${dto.className} Sem ${dto.fromSemester}. Promote or delete it first.`,
      );
    }

    const criteria: PromotionCriteria = {
      minAttendancePct: dto.criteria?.minAttendancePct ?? 75,
      minIaScore: dto.criteria?.minIaScore ?? 40,
      feeClearanceRequired: dto.criteria?.feeClearanceRequired ?? true,
    };

    // Phase 2: replace with real API calls to attendance/marks/fees services
    // For now, use mock data and re-evaluate against given criteria
    const students: StudentEligibility[] = MOCK_STUDENT_DATA.map((s) => {
      const failedCriteria: string[] = [];
      if (s.attendancePct < criteria.minAttendancePct)
        failedCriteria.push('ATTENDANCE_LOW');
      if (s.iaScore < criteria.minIaScore) failedCriteria.push('IA_BELOW_MIN');
      if (criteria.feeClearanceRequired && !s.feeCleared)
        failedCriteria.push('FEE_PENDING');

      let status: PromotionStatus = 'ELIGIBLE';
      if (failedCriteria.length > 0) {
        status = s.overrideNote ? 'CONDITIONAL' : 'DETAINED';
      }

      return {
        ...s,
        currentSemester: dto.fromSemester,
        targetSemester: dto.fromSemester + 1,
        failedCriteria,
        status,
      };
    });

    const batch: PromotionBatch = {
      id: randomUUID(),
      classId: dto.classId,
      className: dto.className,
      fromSemester: dto.fromSemester,
      toSemester: dto.fromSemester + 1,
      academicYear: dto.academicYear,
      generatedAt: new Date().toISOString(),
      criteria,
      students,
      stats: {
        total: students.length,
        eligible: students.filter((s) => s.status === 'ELIGIBLE').length,
        detained: students.filter((s) => s.status === 'DETAINED').length,
        conditional: students.filter((s) => s.status === 'CONDITIONAL').length,
        promoted: 0,
      },
    };

    BATCHES.push(batch);
    return batch;
  }

  /**
   * PATCH /api/promotion/batches/:id/override
   * Override a single student's status (e.g. medical exemption).
   */
  overrideStudent(
    batchId: string,
    studentUsn: string,
    dto: { status: PromotionStatus; note: string; overriddenBy: string },
  ): PromotionBatch {
    const batch = this.findById(batchId);
    if (batch.promotedAt)
      throw new BadRequestException('Cannot override a completed promotion batch');

    const student = batch.students.find((s) => s.studentUsn === studentUsn);
    if (!student) throw new NotFoundException(`Student ${studentUsn} not in batch`);

    student.status = dto.status;
    student.overrideNote = dto.note;
    student.overriddenBy = dto.overriddenBy;
    this.refreshStats(batch);
    return batch;
  }

  /**
   * POST /api/promotion/batches/:id/promote
   * Execute the promotion — advance all ELIGIBLE and CONDITIONAL students.
   * Detained students are NOT promoted.
   */
  executeBatchPromotion(
    batchId: string,
    promotedBy: string,
  ): { promoted: string[]; detained: string[] } {
    const batch = this.findById(batchId);
    if (batch.promotedAt)
      throw new BadRequestException('This batch has already been promoted');

    const promoted: string[] = [];
    const detained: string[] = [];

    for (const s of batch.students) {
      if (s.status === 'ELIGIBLE' || s.status === 'CONDITIONAL') {
        s.status = 'PROMOTED';
        promoted.push(s.studentUsn);
        // Phase 2: call identity service PATCH /api/students/:usn/semester { semester: targetSemester }
        // Phase 2: call academics service PATCH /api/enrollments/:id to move student to new class
      } else {
        detained.push(s.studentUsn);
        // Phase 2: send parent notification via comms service
      }
    }

    batch.promotedAt = new Date().toISOString();
    batch.promotedBy = promotedBy;
    this.refreshStats(batch);

    return { promoted, detained };
  }

  /**
   * GET /api/promotion/detention-list?classId=&semester=
   * Returns students who are detained and cannot be promoted.
   */
  getDetentionList(classId?: string, semester?: number): StudentEligibility[] {
    let detained: StudentEligibility[] = [];
    const relevantBatches = BATCHES.filter(
      (b) =>
        (!classId || b.classId === classId) &&
        (!semester || b.fromSemester === semester),
    );
    for (const batch of relevantBatches) {
      detained = detained.concat(
        batch.students.filter((s) => s.status === 'DETAINED'),
      );
    }
    return detained;
  }

  private refreshStats(batch: PromotionBatch): void {
    batch.stats = {
      total: batch.students.length,
      eligible: batch.students.filter((s) => s.status === 'ELIGIBLE').length,
      detained: batch.students.filter((s) => s.status === 'DETAINED').length,
      conditional: batch.students.filter((s) => s.status === 'CONDITIONAL').length,
      promoted: batch.students.filter((s) => s.status === 'PROMOTED').length,
    };
  }
}
