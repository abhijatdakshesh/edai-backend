import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { PlacementController } from './placement.controller';
import { PlacementScoreService } from './placement-score.service';
import { PlacementMatchingService } from './placement-matching.service';
import { PlacementResumeService } from './placement-resume.service';
import type { Response } from 'express';

// ---------------------------------------------------------------------------
// Guard bypass — replace real guards with pass-through mocks
// ---------------------------------------------------------------------------

jest.mock('../auth/jwt-auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../roles/roles.guard', () => ({
  RolesGuard: class {
    canActivate() {
      return true;
    }
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PROFILE = {
  usn: '1RV21CS001',
  name: 'Alice Sharma',
  department: 'CSE',
  semester: 8,
  section: 'A',
  cgpa: 8.5,
  attendancePct: 85,
  backlogs: 0,
  readinessScore: 78,
  placementStatus: 'PLACEMENT_READY' as const,
  subjects: [],
  scoreBreakdown: { cgpaPts: 28, attendancePts: 18, backlogPts: 20, trendPts: 5, semesterPts: 10 },
};

const MOCK_MATCHES = [
  { fit_score: 85, prediction_pct: 65, company_name: 'Infosys', role_offered: 'SDE', ctc_lpa: 6 },
];

const MOCK_COMPANIES = [
  { id: 'co-1', name: 'Infosys', matched_students: '3', offers_made: '1' },
];

const MOCK_PDF = Buffer.from('%PDF-1.4 fake-pdf-data');

function mockRes(): jest.Mocked<Response> {
  const res = {
    set: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    headersSent: false,
  } as unknown as jest.Mocked<Response>;
  return res;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PlacementController', () => {
  let controller: PlacementController;
  let scoreService: jest.Mocked<PlacementScoreService>;
  let matchingService: jest.Mocked<PlacementMatchingService>;
  let resumeService: jest.Mocked<PlacementResumeService>;
  let mockDbQuery: jest.Mock;

  beforeEach(async () => {
    scoreService = {
      getStudentProfile: jest.fn(),
      getDepartmentSummary: jest.fn(),
      getTopStudents: jest.fn(),
      getAllReadyStudents: jest.fn(),
    } as unknown as jest.Mocked<PlacementScoreService>;

    matchingService = {
      getMatchesForStudent: jest.fn(),
      matchStudentsToCompany: jest.fn(),
      getTopStudentsForCompany: jest.fn(),
    } as unknown as jest.Mocked<PlacementMatchingService>;

    resumeService = {
      generateResume: jest.fn(),
    } as unknown as jest.Mocked<PlacementResumeService>;

    mockDbQuery = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlacementController],
      providers: [
        { provide: PlacementScoreService, useValue: scoreService },
        { provide: PlacementMatchingService, useValue: matchingService },
        { provide: PlacementResumeService, useValue: resumeService },
        { provide: getDataSourceToken(), useValue: { query: mockDbQuery } },
      ],
    }).compile();

    controller = module.get<PlacementController>(PlacementController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── GET /placement/student/:usn ───────────────────────────────────────────

  describe('getStudentProfile()', () => {
    it('delegates to scoreService.getStudentProfile and returns the profile', async () => {
      scoreService.getStudentProfile.mockResolvedValue(MOCK_PROFILE);
      const result = await controller.getStudentProfile('1RV21CS001');
      expect(scoreService.getStudentProfile).toHaveBeenCalledWith('1RV21CS001');
      expect(result).toBe(MOCK_PROFILE);
    });

    it('propagates thrown error when student not found', async () => {
      scoreService.getStudentProfile.mockRejectedValue(new Error('Student 1RV21XX999 not found'));
      await expect(controller.getStudentProfile('1RV21XX999')).rejects.toThrow(
        'Student 1RV21XX999 not found',
      );
    });
  });

  // ── GET /placement/student/:usn/matches ───────────────────────────────────

  describe('getStudentMatches()', () => {
    it('returns match list from matchingService', async () => {
      matchingService.getMatchesForStudent.mockResolvedValue(MOCK_MATCHES as never);
      const result = await controller.getStudentMatches('1RV21CS001');
      expect(matchingService.getMatchesForStudent).toHaveBeenCalledWith('1RV21CS001');
      expect(result).toBe(MOCK_MATCHES);
    });

    it('returns empty array when student has no matches', async () => {
      matchingService.getMatchesForStudent.mockResolvedValue([] as never);
      const result = await controller.getStudentMatches('1RV21CS001');
      expect(result).toEqual([]);
    });
  });

  // ── POST /placement/student/:usn/resume ───────────────────────────────────

  describe('generateResume()', () => {
    it('sends PDF buffer with correct headers on success', async () => {
      resumeService.generateResume.mockResolvedValue(MOCK_PDF);
      const res = mockRes();

      await controller.generateResume(
        '1RV21CS001',
        { companyType: 'PRODUCT' },
        res,
      );

      expect(resumeService.generateResume).toHaveBeenCalledWith('1RV21CS001', 'PRODUCT');
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="1RV21CS001_resume_PRODUCT.pdf"',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(MOCK_PDF);
    });

    it('defaults companyType to SERVICE when not provided in body', async () => {
      resumeService.generateResume.mockResolvedValue(MOCK_PDF);
      const res = mockRes();

      await controller.generateResume(
        '1RV21CS001',
        { companyType: undefined as unknown as 'SERVICE' },
        res,
      );

      expect(resumeService.generateResume).toHaveBeenCalledWith('1RV21CS001', 'SERVICE');
    });

    it('returns 500 JSON error when resume generation throws and headers not yet sent', async () => {
      resumeService.generateResume.mockRejectedValue(new Error('Claude API down'));
      const res = mockRes();
      (res as unknown as Record<string, unknown>)['headersSent'] = false;

      await controller.generateResume('1RV21CS001', { companyType: 'STARTUP' }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Claude API down' });
    });

    it('does NOT call res.status when headers already sent (avoids double-send)', async () => {
      resumeService.generateResume.mockRejectedValue(new Error('crash'));
      const res = mockRes();
      (res as unknown as Record<string, unknown>)['headersSent'] = true;

      await controller.generateResume('1RV21CS001', { companyType: 'CORE' }, res);

      expect(res.status).not.toHaveBeenCalled();
    });

    it('all four companyType values are accepted without error', async () => {
      for (const companyType of ['PRODUCT', 'SERVICE', 'STARTUP', 'CORE'] as const) {
        resumeService.generateResume.mockResolvedValue(MOCK_PDF);
        const res = mockRes();
        await controller.generateResume('1RV21CS001', { companyType }, res);
        expect(res.status).toHaveBeenCalledWith(200);
        jest.clearAllMocks();
      }
    });
  });

  // ── GET /placement/dashboard/summary ─────────────────────────────────────

  describe('getDashboardSummary()', () => {
    it('passes department and parsed semester to scoreService', async () => {
      scoreService.getDepartmentSummary.mockResolvedValue([]);
      await controller.getDashboardSummary('CSE', '8');
      expect(scoreService.getDepartmentSummary).toHaveBeenCalledWith('CSE', 8);
    });

    it('passes undefined for empty department string', async () => {
      scoreService.getDepartmentSummary.mockResolvedValue([]);
      await controller.getDashboardSummary('', '');
      expect(scoreService.getDepartmentSummary).toHaveBeenCalledWith(undefined, undefined);
    });

    it('passes undefined semester when semester query param is absent', async () => {
      scoreService.getDepartmentSummary.mockResolvedValue([]);
      await controller.getDashboardSummary('ECE', '');
      expect(scoreService.getDepartmentSummary).toHaveBeenCalledWith('ECE', undefined);
    });

    it('returns the department summary rows', async () => {
      const rows = [{ department: 'CSE', semester: 8, total: '45' }];
      scoreService.getDepartmentSummary.mockResolvedValue(rows as never);
      const result = await controller.getDashboardSummary('CSE', '8');
      expect(result).toBe(rows);
    });
  });

  // ── GET /placement/dashboard/top-students ────────────────────────────────

  describe('getTopStudents()', () => {
    it('passes correct args with default semester 8 and limit 20', async () => {
      scoreService.getTopStudents.mockResolvedValue([]);
      await controller.getTopStudents('CSE', '', '');
      expect(scoreService.getTopStudents).toHaveBeenCalledWith('CSE', 8, 20);
    });

    it('passes custom semester and limit when provided', async () => {
      scoreService.getTopStudents.mockResolvedValue([]);
      await controller.getTopStudents('ISE', '6', '10');
      expect(scoreService.getTopStudents).toHaveBeenCalledWith('ISE', 6, 10);
    });

    it('returns the student list', async () => {
      const rows = [{ usn: '1RV21CS001', readiness_score: 85 }];
      scoreService.getTopStudents.mockResolvedValue(rows as never);
      const result = await controller.getTopStudents('CSE', '8', '5');
      expect(result).toBe(rows);
    });
  });

  // ── GET /placement/dashboard/ready ───────────────────────────────────────

  describe('getReadyStudents()', () => {
    it('uses default minScore 60 when query param is absent', async () => {
      scoreService.getAllReadyStudents.mockResolvedValue([]);
      await controller.getReadyStudents('');
      expect(scoreService.getAllReadyStudents).toHaveBeenCalledWith(60);
    });

    it('passes custom minScore when provided', async () => {
      scoreService.getAllReadyStudents.mockResolvedValue([]);
      await controller.getReadyStudents('75');
      expect(scoreService.getAllReadyStudents).toHaveBeenCalledWith(75);
    });

    it('returns the ready students list', async () => {
      const rows = [{ usn: '1RV21CS001', readiness_score: 82 }];
      scoreService.getAllReadyStudents.mockResolvedValue(rows as never);
      const result = await controller.getReadyStudents('60');
      expect(result).toBe(rows);
    });
  });

  // ── GET /placement/companies ──────────────────────────────────────────────

  describe('getCompanies()', () => {
    it('queries active companies with join counts and returns results', async () => {
      mockDbQuery.mockResolvedValue(MOCK_COMPANIES);
      const result = await controller.getCompanies();
      expect(mockDbQuery).toHaveBeenCalledTimes(1);
      const [sql] = mockDbQuery.mock.calls[0] as [string, ...unknown[]];
      expect(sql).toContain('WHERE pc.active = true');
      expect(result).toBe(MOCK_COMPANIES);
    });

    it('returns empty array when no active companies', async () => {
      mockDbQuery.mockResolvedValue([]);
      const result = await controller.getCompanies();
      expect(result).toEqual([]);
    });
  });

  // ── POST /placement/companies ─────────────────────────────────────────────

  describe('addCompany()', () => {
    const COMPANY_DTO = {
      name: 'Wipro',
      industry: 'IT Services',
      roleOffered: 'Software Engineer',
      ctcLpa: 4.5,
      minCgpa: 6.5,
      eligibleBranches: ['CSE', 'ISE', 'ECE'],
      eligibleSemesters: [7, 8],
      requiredSkills: ['Java', 'SQL'],
      companyType: 'SERVICE',
      driveDate: '2026-09-15',
    };

    it('inserts company with all fields and returns new id', async () => {
      const inserted = [{ id: 'co-new' }];
      mockDbQuery.mockResolvedValue(inserted);

      const result = await controller.addCompany(COMPANY_DTO);

      expect(mockDbQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO placement_companies');
      expect(sql).toContain('RETURNING id');
      expect(params).toContain('Wipro');
      expect(params).toContain(4.5);
      expect(result).toBe(inserted);
    });

    it('propagates DB error on duplicate company name', async () => {
      mockDbQuery.mockRejectedValue(new Error('unique constraint violation'));
      await expect(controller.addCompany(COMPANY_DTO)).rejects.toThrow('unique constraint violation');
    });
  });

  // ── POST /placement/companies/:id/match ──────────────────────────────────

  describe('runMatching()', () => {
    it('returns matched count from matchingService', async () => {
      matchingService.matchStudentsToCompany.mockResolvedValue(42);
      const result = await controller.runMatching('co-1');
      expect(matchingService.matchStudentsToCompany).toHaveBeenCalledWith('co-1');
      expect(result).toEqual({ matched: 42 });
    });

    it('returns { matched: 0 } when no students are eligible', async () => {
      matchingService.matchStudentsToCompany.mockResolvedValue(0);
      const result = await controller.runMatching('co-empty');
      expect(result).toEqual({ matched: 0 });
    });

    it('propagates error when company not found', async () => {
      matchingService.matchStudentsToCompany.mockRejectedValue(new Error('Company not found'));
      await expect(controller.runMatching('nonexistent')).rejects.toThrow('Company not found');
    });
  });

  // ── GET /placement/companies/:id/students ────────────────────────────────

  describe('getCompanyStudents()', () => {
    it('uses default limit 15 when param is absent', async () => {
      matchingService.getTopStudentsForCompany.mockResolvedValue([]);
      await controller.getCompanyStudents('co-1', '');
      expect(matchingService.getTopStudentsForCompany).toHaveBeenCalledWith('co-1', 15);
    });

    it('passes custom limit when provided', async () => {
      matchingService.getTopStudentsForCompany.mockResolvedValue([]);
      await controller.getCompanyStudents('co-1', '5');
      expect(matchingService.getTopStudentsForCompany).toHaveBeenCalledWith('co-1', 5);
    });

    it('returns the student list', async () => {
      const rows = [{ usn: '1RV21CS001', fit_score: 88 }];
      matchingService.getTopStudentsForCompany.mockResolvedValue(rows as never);
      const result = await controller.getCompanyStudents('co-1', '10');
      expect(result).toBe(rows);
    });
  });

  // ── POST /placement/offers ────────────────────────────────────────────────

  describe('recordOffer()', () => {
    const OFFER_DTO = {
      studentUsn: '1RV21CS001',
      companyId: 'co-1',
      ctcLpa: 8.5,
      role: 'SDE-1',
      offerDate: '2026-09-20',
    };

    it('inserts offer and updates match status, returns the new offer row', async () => {
      const insertResult = [{ id: 'offer-1' }];
      mockDbQuery
        .mockResolvedValueOnce(insertResult)   // INSERT INTO placement_offers
        .mockResolvedValueOnce([]);            // UPDATE placement_matches

      const result = await controller.recordOffer(OFFER_DTO);

      expect(mockDbQuery).toHaveBeenCalledTimes(2);

      // Verify INSERT call
      const [insertSql, insertParams] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(insertSql).toContain('INSERT INTO placement_offers');
      expect(insertParams).toContain('1RV21CS001');
      expect(insertParams).toContain(8.5);

      // Verify UPDATE call sets status = 'OFFERED'
      const [updateSql, updateParams] = mockDbQuery.mock.calls[1] as [string, unknown[]];
      expect(updateSql).toContain("status = 'OFFERED'");
      expect(updateParams).toContain('1RV21CS001');
      expect(updateParams).toContain('co-1');

      // Returns the first row of the INSERT RETURNING
      expect(result).toEqual({ id: 'offer-1' });
    });

    it('propagates DB error when INSERT fails (FK violation for invalid student USN)', async () => {
      mockDbQuery.mockRejectedValue(new Error('foreign key violation'));
      await expect(controller.recordOffer(OFFER_DTO)).rejects.toThrow('foreign key violation');
    });

    it('propagates DB error when UPDATE match status fails', async () => {
      mockDbQuery
        .mockResolvedValueOnce([{ id: 'offer-2' }])
        .mockRejectedValueOnce(new Error('update failed'));
      await expect(controller.recordOffer(OFFER_DTO)).rejects.toThrow('update failed');
    });
  });

  // ── GET /placement/analytics/offers ──────────────────────────────────────

  describe('getOffersAnalytics()', () => {
    it('queries without WHERE clause when no department filter', async () => {
      mockDbQuery.mockResolvedValue([]);
      await controller.getOffersAnalytics('');
      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toContain('WHERE');
      expect(params).toEqual([]);
    });

    it('queries with WHERE clause when department is specified', async () => {
      const rows = [{ department: 'CSE', total_offers: '5', avg_ctc: '8.50' }];
      mockDbQuery.mockResolvedValue(rows);
      const result = await controller.getOffersAnalytics('CSE');
      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('WHERE s.department = $1');
      expect(params).toEqual(['CSE']);
      expect(result).toBe(rows);
    });

    it('returns empty array when no offers exist', async () => {
      mockDbQuery.mockResolvedValue([]);
      const result = await controller.getOffersAnalytics('MECH');
      expect(result).toEqual([]);
    });

    it('returns aggregated rows across all departments when no filter', async () => {
      const rows = [
        { department: 'CSE', total_offers: '10', avg_ctc: '9.20' },
        { department: 'ECE', total_offers: '4', avg_ctc: '7.50' },
      ];
      mockDbQuery.mockResolvedValue(rows);
      const result = await controller.getOffersAnalytics('');
      expect(result).toHaveLength(2);
    });
  });
});
