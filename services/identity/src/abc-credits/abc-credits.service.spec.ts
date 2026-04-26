import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AbcCreditsService, AbcCreditEntry } from './abc-credits.service';

const makeEntry = (overrides: Partial<Omit<AbcCreditEntry, 'id' | 'verified' | 'abcId'>> = {}): Omit<AbcCreditEntry, 'id' | 'verified' | 'abcId'> => ({
  usn: '1RV21CS001',
  institutionId: 'rvce',
  courseName: 'Data Science with Python',
  courseCode: 'NPTEL-DS-101',
  credits: 4,
  source: 'NPTEL',
  completedAt: '2026-03-15',
  grade: 'ELITE+GOLD',
  ...overrides,
});

describe('AbcCreditsService — NEP 2020 / ABC Framework', () => {
  let service: AbcCreditsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AbcCreditsService],
    }).compile();
    service = module.get<AbcCreditsService>(AbcCreditsService);
  });

  // ─── addCredits ───────────────────────────────────────────────────────────

  describe('addCredits()', () => {
    it('creates entry with verified=false and abcId=null', () => {
      const result = service.addCredits(makeEntry());
      expect(result.verified).toBe(false);
      expect(result.abcId).toBeNull();
      expect(result.id).toMatch(/^abc-/);
    });

    it('adds to entries array', () => {
      service.addCredits(makeEntry());
      expect(service.entries).toHaveLength(1);
    });

    it('throws BadRequestException for credits <= 0', () => {
      expect(() => service.addCredits(makeEntry({ credits: 0 }))).toThrow(BadRequestException);
      expect(() => service.addCredits(makeEntry({ credits: -1 }))).toThrow(BadRequestException);
    });

    it('throws BadRequestException for credits > 30', () => {
      expect(() => service.addCredits(makeEntry({ credits: 31 }))).toThrow(BadRequestException);
    });

    it('accepts credits at boundary (1 and 30)', () => {
      expect(() => service.addCredits(makeEntry({ credits: 1 }))).not.toThrow();
      expect(() => service.addCredits(makeEntry({ credits: 30 }))).not.toThrow();
    });
  });

  // ─── getLedger ────────────────────────────────────────────────────────────

  describe('getLedger()', () => {
    it('returns empty ledger for unknown student', () => {
      const ledger = service.getLedger('UNKNOWN', 'rvce');
      expect(ledger.totalCredits).toBe(0);
      expect(ledger.entries).toEqual([]);
    });

    it('sums totalCredits correctly', () => {
      service.addCredits(makeEntry({ credits: 4 }));
      service.addCredits(makeEntry({ credits: 3, courseCode: 'NPTEL-ML-102' }));
      const ledger = service.getLedger('1RV21CS001', 'rvce');
      expect(ledger.totalCredits).toBe(7);
    });

    it('isolates by institutionId (multi-tenant)', () => {
      service.addCredits(makeEntry({ institutionId: 'rvce', credits: 4 }));
      service.addCredits(makeEntry({ institutionId: 'rvitm', credits: 6, courseCode: 'X-101' }));
      expect(service.getLedger('1RV21CS001', 'rvce').totalCredits).toBe(4);
      expect(service.getLedger('1RV21CS001', 'rvitm').totalCredits).toBe(6);
    });

    it('separates verifiedCredits from pendingCredits', () => {
      const e1 = service.addCredits(makeEntry({ credits: 4 }));
      service.addCredits(makeEntry({ credits: 3, courseCode: 'Y-101' }));
      service.verifyCredit(e1.id, 'ABC-VERIFY-001');
      const ledger = service.getLedger('1RV21CS001', 'rvce');
      expect(ledger.verifiedCredits).toBe(4);
      expect(ledger.pendingCredits).toBe(3);
    });
  });

  // ─── verifyCredit ─────────────────────────────────────────────────────────

  describe('verifyCredit()', () => {
    it('sets verified=true and assigns abcId', () => {
      const entry = service.addCredits(makeEntry());
      const result = service.verifyCredit(entry.id, 'ABC-12345');
      expect(result.verified).toBe(true);
      expect(result.abcId).toBe('ABC-12345');
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => service.verifyCredit('nonexistent', 'ABC-X')).toThrow(NotFoundException);
    });
  });

  // ─── transferCredits ──────────────────────────────────────────────────────

  describe('transferCredits()', () => {
    it('creates TRANSFER entries for each course', () => {
      const result = service.transferCredits('1RV21CS001', 'VTU-UVCE', [
        { courseName: 'Machine Learning', courseCode: 'ML-501', credits: 4, grade: 'A', completedAt: '2025-12-01' },
        { courseName: 'Cloud Computing',  courseCode: 'CC-502', credits: 3, grade: 'B+', completedAt: '2025-12-01' },
      ]);
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.source === 'TRANSFER')).toBe(true);
      expect(result.every((e) => e.verified === false)).toBe(true);
    });

    it('all transferred credits are unverified initially', () => {
      service.transferCredits('1RV21CS001', 'MSRIT', [
        { courseName: 'IoT', courseCode: 'IOT-301', credits: 2, grade: 'A+', completedAt: '2025-11-01' },
      ]);
      const ledger = service.getLedger('1RV21CS001', 'default');
      expect(ledger.verifiedCredits).toBe(0);
      expect(ledger.pendingCredits).toBe(2);
    });
  });

  // ─── NEP 2020 electives ───────────────────────────────────────────────────

  describe('addElective() / getElectives()', () => {
    it('adds and retrieves electives for a student', () => {
      service.addElective({ usn: '1RV21CS001', semesterNumber: 5, courseName: 'Environmental Science', courseCode: 'EVS-501', credits: 2, outsideMajor: true, dept: 'CIVIL' });
      const result = service.getElectives('1RV21CS001');
      expect(result).toHaveLength(1);
      expect(result[0].outsideMajor).toBe(true);
    });

    it('returns empty for student with no electives', () => {
      expect(service.getElectives('UNKNOWN')).toEqual([]);
    });
  });

  // ─── NEP 2020 compliance check ────────────────────────────────────────────

  describe('checkNepCompliance()', () => {
    it('returns non-compliant when all thresholds unmet', () => {
      const result = service.checkNepCompliance('1RV21CS001', 50);
      expect(result.compliant).toBe(false);
      expect(result.coreCreditsOk).toBe(false);
      expect(result.electiveCreditsOk).toBe(false);
      expect(result.outsideMajorOk).toBe(false);
      expect(result.missingRequirements.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('is compliant when all thresholds met', () => {
      // 20 elective credits (>= 20 required)
      for (let i = 0; i < 5; i++) {
        service.addElective({ usn: '1RV21CS001', semesterNumber: i + 1, courseName: `Elective ${i}`, courseCode: `EL-${i}`, credits: 4, outsideMajor: true, dept: 'PHYSICS' });
      }
      // 4 verified ABC credits
      const e = service.addCredits(makeEntry({ credits: 4, institutionId: 'default' }));
      service.verifyCredit(e.id, 'ABC-COMP-001');

      const result = service.checkNepCompliance('1RV21CS001', 120, 'default');
      expect(result.coreCreditsOk).toBe(true);
      expect(result.electiveCreditsOk).toBe(true);
      expect(result.outsideMajorOk).toBe(true);
      expect(result.abcVerifiedOk).toBe(true);
      expect(result.compliant).toBe(true);
      expect(result.missingRequirements).toEqual([]);
    });

    it('abcVerifiedOk is false when no verified credits', () => {
      service.addCredits(makeEntry({ credits: 4, institutionId: 'default' })); // unverified
      const result = service.checkNepCompliance('1RV21CS001', 120, 'default');
      expect(result.abcVerifiedOk).toBe(false);
    });

    it('outsideMajorOk requires credits from outside major', () => {
      // 4 credits inside major — should NOT satisfy outside-major requirement
      service.addElective({ usn: '1RV21CS001', semesterNumber: 1, courseName: 'DSA', courseCode: 'DSA-101', credits: 4, outsideMajor: false, dept: 'CSE' });
      const result = service.checkNepCompliance('1RV21CS001', 120, 'default');
      expect(result.outsideMajorOk).toBe(false);
    });
  });

  // ─── getInstitutionSummary ────────────────────────────────────────────────

  describe('getInstitutionSummary()', () => {
    it('returns zeros for empty institution', () => {
      const result = service.getInstitutionSummary('empty-inst');
      expect(result.totalStudentsWithCredits).toBe(0);
      expect(result.totalAbcCredits).toBe(0);
      expect(result.avgCreditsPerStudent).toBe(0);
    });

    it('counts unique students correctly', () => {
      service.addCredits(makeEntry({ usn: 'USN1', institutionId: 'rvce', credits: 4 }));
      service.addCredits(makeEntry({ usn: 'USN1', institutionId: 'rvce', credits: 3, courseCode: 'X2' }));
      service.addCredits(makeEntry({ usn: 'USN2', institutionId: 'rvce', credits: 4, courseCode: 'X3' }));
      const result = service.getInstitutionSummary('rvce');
      expect(result.totalStudentsWithCredits).toBe(2);
      expect(result.totalAbcCredits).toBe(11);
    });

    it('sourceBreakdown groups by source', () => {
      service.addCredits(makeEntry({ source: 'NPTEL', credits: 4, institutionId: 'rvce', courseCode: 'N1' }));
      service.addCredits(makeEntry({ source: 'SWAYAM', credits: 2, institutionId: 'rvce', courseCode: 'S1' }));
      service.addCredits(makeEntry({ source: 'NPTEL', credits: 3, institutionId: 'rvce', courseCode: 'N2' }));
      const result = service.getInstitutionSummary('rvce');
      expect(result.sourceBreakdown['NPTEL']).toBe(7);
      expect(result.sourceBreakdown['SWAYAM']).toBe(2);
    });

    it('isolates by institutionId', () => {
      service.addCredits(makeEntry({ institutionId: 'rvce', credits: 10, courseCode: 'A1' }));
      service.addCredits(makeEntry({ institutionId: 'rvitm', credits: 20, courseCode: 'B1' }));
      expect(service.getInstitutionSummary('rvce').totalAbcCredits).toBe(10);
      expect(service.getInstitutionSummary('rvitm').totalAbcCredits).toBe(20);
    });
  });
});
