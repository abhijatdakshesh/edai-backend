import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

export interface AbcCreditEntry {
  id: string;
  usn: string;
  institutionId: string;
  courseName: string;
  courseCode: string;
  credits: number;
  /** MOOC, NPTEL, SWAYAM, TRANSFER, INTERNAL */
  source: 'MOOC' | 'NPTEL' | 'SWAYAM' | 'TRANSFER' | 'INTERNAL';
  completedAt: string;
  /** ABC DigiLocker verification ID (null = pending verification) */
  abcId: string | null;
  verified: boolean;
  grade: string;
}

export interface AbcLedger {
  usn: string;
  institutionId: string;
  totalCredits: number;
  verifiedCredits: number;
  pendingCredits: number;
  entries: AbcCreditEntry[];
}

export interface MultidisciplinaryElective {
  usn: string;
  semesterNumber: number;
  courseName: string;
  courseCode: string;
  credits: number;
  /** NEP 2020 requires at least one course from outside the major discipline */
  outsideMajor: boolean;
  dept: string;
}

/** NEP 2020 minimum credit requirements */
const NEP_MIN_CORE_CREDITS = 120;
const NEP_MIN_ELECTIVE_CREDITS = 20;
const NEP_MIN_OUTSIDE_MAJOR_CREDITS = 4;

@Injectable()
export class AbcCreditsService {
  entries: AbcCreditEntry[] = [];
  electives: MultidisciplinaryElective[] = [];

  // ─── ABC Credit Ledger ────────────────────────────────────────────────────

  getLedger(usn: string, institutionId = 'default'): AbcLedger {
    const studentEntries = this.entries.filter(
      (e) => e.usn === usn && e.institutionId === institutionId,
    );
    const totalCredits = studentEntries.reduce((s, e) => s + e.credits, 0);
    const verifiedCredits = studentEntries
      .filter((e) => e.verified)
      .reduce((s, e) => s + e.credits, 0);
    return {
      usn,
      institutionId,
      totalCredits,
      verifiedCredits,
      pendingCredits: totalCredits - verifiedCredits,
      entries: studentEntries,
    };
  }

  addCredits(entry: Omit<AbcCreditEntry, 'id' | 'verified' | 'abcId'>): AbcCreditEntry {
    if (entry.credits <= 0) throw new BadRequestException('Credits must be greater than 0');
    if (entry.credits > 30) throw new BadRequestException('Credits cannot exceed 30 per course');
    const record: AbcCreditEntry = {
      ...entry,
      id: `abc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      verified: false,
      abcId: null,
    };
    this.entries.push(record);
    return record;
  }

  verifyCredit(id: string, abcId: string): AbcCreditEntry {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw new NotFoundException(`ABC credit entry ${id} not found`);
    entry.verified = true;
    entry.abcId = abcId;
    return entry;
  }

  /** Transfer credits from another institution (ABC DigiLocker pull) */
  transferCredits(
    usn: string,
    fromInstitution: string,
    courses: Array<{ courseName: string; courseCode: string; credits: number; grade: string; completedAt: string }>,
    toInstitutionId = 'default',
  ): AbcCreditEntry[] {
    return courses.map((c) =>
      this.addCredits({
        usn,
        institutionId: toInstitutionId,
        courseName: c.courseName,
        courseCode: c.courseCode,
        credits: c.credits,
        source: 'TRANSFER',
        completedAt: c.completedAt,
        grade: c.grade,
      }),
    );
  }

  // ─── NEP 2020 Compliance ─────────────────────────────────────────────────

  getElectives(usn: string): MultidisciplinaryElective[] {
    return this.electives.filter((e) => e.usn === usn);
  }

  addElective(elective: MultidisciplinaryElective): MultidisciplinaryElective {
    this.electives.push(elective);
    return elective;
  }

  /**
   * NEP 2020 compliance check — validates credit thresholds.
   * Returns compliance status and missing requirements.
   */
  checkNepCompliance(
    usn: string,
    coreCredits: number,
    institutionId = 'default',
  ): {
    compliant: boolean;
    coreCreditsOk: boolean;
    electiveCreditsOk: boolean;
    outsideMajorOk: boolean;
    abcVerifiedOk: boolean;
    missingRequirements: string[];
    recommendations: string[];
  } {
    const ledger = this.getLedger(usn, institutionId);
    const studentElectives = this.getElectives(usn);
    const totalElectiveCredits = studentElectives.reduce((s, e) => s + e.credits, 0);
    const outsideMajorCredits = studentElectives
      .filter((e) => e.outsideMajor)
      .reduce((s, e) => s + e.credits, 0);

    const coreCreditsOk = coreCredits >= NEP_MIN_CORE_CREDITS;
    const electiveCreditsOk = totalElectiveCredits >= NEP_MIN_ELECTIVE_CREDITS;
    const outsideMajorOk = outsideMajorCredits >= NEP_MIN_OUTSIDE_MAJOR_CREDITS;
    const abcVerifiedOk = ledger.verifiedCredits >= 4;

    const missingRequirements: string[] = [];
    if (!coreCreditsOk) missingRequirements.push(`Need ${NEP_MIN_CORE_CREDITS - coreCredits} more core credits`);
    if (!electiveCreditsOk) missingRequirements.push(`Need ${NEP_MIN_ELECTIVE_CREDITS - totalElectiveCredits} more elective credits`);
    if (!outsideMajorOk) missingRequirements.push(`Need ${NEP_MIN_OUTSIDE_MAJOR_CREDITS - outsideMajorCredits} more credits from outside major discipline`);
    if (!abcVerifiedOk) missingRequirements.push('Complete at least 4 ABC-verified credits (NPTEL/SWAYAM/MOOC)');

    const recommendations: string[] = [];
    if (!electiveCreditsOk) recommendations.push('Enroll in SWAYAM/NPTEL MOOC courses for elective credits');
    if (!outsideMajorOk) recommendations.push('Choose a Value Added Course (VAC) from another department');
    if (!abcVerifiedOk) recommendations.push('Link NPTEL certificates to your ABC DigiLocker account');

    return {
      compliant: coreCreditsOk && electiveCreditsOk && outsideMajorOk && abcVerifiedOk,
      coreCreditsOk,
      electiveCreditsOk,
      outsideMajorOk,
      abcVerifiedOk,
      missingRequirements,
      recommendations,
    };
  }

  /** Summary across all students — for admin/HOD view */
  getInstitutionSummary(institutionId = 'default'): {
    totalStudentsWithCredits: number;
    totalAbcCredits: number;
    verifiedCredits: number;
    avgCreditsPerStudent: number;
    sourceBreakdown: Record<string, number>;
  } {
    const institutionEntries = this.entries.filter((e) => e.institutionId === institutionId);
    const uniqueStudents = new Set(institutionEntries.map((e) => e.usn));
    const totalCredits = institutionEntries.reduce((s, e) => s + e.credits, 0);
    const verifiedCredits = institutionEntries.filter((e) => e.verified).reduce((s, e) => s + e.credits, 0);
    const sourceBreakdown = institutionEntries.reduce<Record<string, number>>((acc, e) => {
      acc[e.source] = (acc[e.source] ?? 0) + e.credits;
      return acc;
    }, {});
    return {
      totalStudentsWithCredits: uniqueStudents.size,
      totalAbcCredits: totalCredits,
      verifiedCredits,
      avgCreditsPerStudent: uniqueStudents.size > 0 ? Math.round(totalCredits / uniqueStudents.size) : 0,
      sourceBreakdown,
    };
  }
}
