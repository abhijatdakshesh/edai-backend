import { Test, TestingModule } from '@nestjs/testing';
import { AbcCreditsController } from './abc-credits.controller';
import { AbcCreditsService } from './abc-credits.service';

const mockSvc = {
  getLedger: jest.fn(),
  addCredits: jest.fn(),
  verifyCredit: jest.fn(),
  transferCredits: jest.fn(),
  getElectives: jest.fn(),
  addElective: jest.fn(),
  checkNepCompliance: jest.fn(),
  getInstitutionSummary: jest.fn(),
};

const makeReq = (overrides: any = {}) => ({
  user: { sapId: '1RV21CS001', sub: 'u-student-01', institutionId: 'rvce', ...overrides.user },
  ...overrides,
});

describe('AbcCreditsController', () => {
  let controller: AbcCreditsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AbcCreditsController],
      providers: [{ provide: AbcCreditsService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../roles/roles.guard').RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AbcCreditsController>(AbcCreditsController);
  });

  describe('getMyLedger()', () => {
    it('uses sapId from req.user', () => {
      mockSvc.getLedger.mockReturnValue({ totalCredits: 4 });
      controller.getMyLedger(makeReq());
      expect(mockSvc.getLedger).toHaveBeenCalledWith('1RV21CS001', 'rvce');
    });

    it('falls back to sub when sapId absent', () => {
      mockSvc.getLedger.mockReturnValue({ totalCredits: 0 });
      controller.getMyLedger({ user: { sub: 'u-1', institutionId: 'rvce' } });
      expect(mockSvc.getLedger).toHaveBeenCalledWith('u-1', 'rvce');
    });

    it('uses INSTITUTION_ID env when institutionId absent', () => {
      process.env['INSTITUTION_ID'] = 'env-inst';
      mockSvc.getLedger.mockReturnValue({});
      controller.getMyLedger({ user: { sub: 'u-1' } });
      expect(mockSvc.getLedger).toHaveBeenCalledWith('u-1', 'env-inst');
      delete process.env['INSTITUTION_ID'];
    });

    it('uses UNKNOWN when no user', () => {
      mockSvc.getLedger.mockReturnValue({});
      controller.getMyLedger({});
      expect(mockSvc.getLedger).toHaveBeenCalledWith('UNKNOWN', 'default');
    });
  });

  describe('getLedger()', () => {
    it('delegates to service with usn and institutionId', () => {
      mockSvc.getLedger.mockReturnValue({ totalCredits: 7 });
      const result = controller.getLedger('1RV21CS002', makeReq());
      expect(mockSvc.getLedger).toHaveBeenCalledWith('1RV21CS002', 'rvce');
      expect(result).toEqual({ totalCredits: 7 });
    });

    it('falls back to env INSTITUTION_ID when no institutionId in user', () => {
      process.env['INSTITUTION_ID'] = 'env-admin-inst';
      mockSvc.getLedger.mockReturnValue({});
      controller.getLedger('1RV21CS002', { user: { sub: 'admin-1' } });
      expect(mockSvc.getLedger).toHaveBeenCalledWith('1RV21CS002', 'env-admin-inst');
      delete process.env['INSTITUTION_ID'];
    });

    it('falls back to default when no env or institutionId', () => {
      mockSvc.getLedger.mockReturnValue({});
      controller.getLedger('1RV21CS002', { user: { sub: 'admin-1' } });
      expect(mockSvc.getLedger).toHaveBeenCalledWith('1RV21CS002', 'default');
    });
  });

  describe('addCredits()', () => {
    it('merges institutionId from req.user into body', () => {
      mockSvc.addCredits.mockReturnValue({ id: 'abc-1' });
      controller.addCredits({ credits: 4, source: 'NPTEL' }, makeReq());
      expect(mockSvc.addCredits).toHaveBeenCalledWith(
        expect.objectContaining({ credits: 4, institutionId: 'rvce' }),
      );
    });

    it('falls back to env INSTITUTION_ID', () => {
      process.env['INSTITUTION_ID'] = 'env-inst';
      mockSvc.addCredits.mockReturnValue({ id: 'abc-2' });
      controller.addCredits({ credits: 2 }, { user: { sub: 'u-1' } });
      expect(mockSvc.addCredits).toHaveBeenCalledWith(
        expect.objectContaining({ institutionId: 'env-inst' }),
      );
      delete process.env['INSTITUTION_ID'];
    });
  });

  describe('verifyCredit()', () => {
    it('delegates id and abcId to service', () => {
      mockSvc.verifyCredit.mockReturnValue({ verified: true });
      const result = controller.verifyCredit('abc-1', { abcId: 'ABC-999' });
      expect(mockSvc.verifyCredit).toHaveBeenCalledWith('abc-1', 'ABC-999');
      expect(result).toEqual({ verified: true });
    });
  });

  describe('transferCredits()', () => {
    it('delegates to service with institutionId from request', () => {
      mockSvc.transferCredits.mockReturnValue([]);
      controller.transferCredits(
        { usn: '1RV21CS001', fromInstitution: 'MSRIT', courses: [] },
        makeReq(),
      );
      expect(mockSvc.transferCredits).toHaveBeenCalledWith('1RV21CS001', 'MSRIT', [], 'rvce');
    });

    it('falls back to default when no institutionId', () => {
      mockSvc.transferCredits.mockReturnValue([]);
      controller.transferCredits(
        { usn: '1RV21CS001', fromInstitution: 'MSRIT', courses: [] },
        { user: { sub: 'admin-1' } },
      );
      expect(mockSvc.transferCredits).toHaveBeenCalledWith('1RV21CS001', 'MSRIT', [], 'default');
    });
  });

  describe('getMyElectives()', () => {
    it('uses sapId', () => {
      mockSvc.getElectives.mockReturnValue([]);
      controller.getMyElectives(makeReq());
      expect(mockSvc.getElectives).toHaveBeenCalledWith('1RV21CS001');
    });

    it('falls back to sub', () => {
      mockSvc.getElectives.mockReturnValue([]);
      controller.getMyElectives({ user: { sub: 'u-1' } });
      expect(mockSvc.getElectives).toHaveBeenCalledWith('u-1');
    });

    it('uses UNKNOWN when no user', () => {
      mockSvc.getElectives.mockReturnValue([]);
      controller.getMyElectives({});
      expect(mockSvc.getElectives).toHaveBeenCalledWith('UNKNOWN');
    });
  });

  describe('addElective()', () => {
    it('delegates body to service', () => {
      mockSvc.addElective.mockReturnValue({ usn: '1RV21CS001' });
      const body = { usn: '1RV21CS001', credits: 4 };
      const result = controller.addElective(body);
      expect(mockSvc.addElective).toHaveBeenCalledWith(body);
      expect(result).toEqual({ usn: '1RV21CS001' });
    });
  });

  describe('checkNepCompliance()', () => {
    it('delegates with parsed coreCredits', () => {
      mockSvc.checkNepCompliance.mockReturnValue({ compliant: true });
      controller.checkNepCompliance('120', makeReq());
      expect(mockSvc.checkNepCompliance).toHaveBeenCalledWith('1RV21CS001', 120, 'rvce');
    });

    it('defaults coreCredits to 0 when absent', () => {
      mockSvc.checkNepCompliance.mockReturnValue({ compliant: false });
      controller.checkNepCompliance(undefined as any, makeReq());
      expect(mockSvc.checkNepCompliance).toHaveBeenCalledWith('1RV21CS001', 0, 'rvce');
    });
  });

  describe('getInstitutionSummary()', () => {
    it('delegates institutionId to service', () => {
      mockSvc.getInstitutionSummary.mockReturnValue({ totalStudentsWithCredits: 5 });
      const result = controller.getInstitutionSummary(makeReq());
      expect(mockSvc.getInstitutionSummary).toHaveBeenCalledWith('rvce');
      expect(result).toEqual({ totalStudentsWithCredits: 5 });
    });

    it('falls back to env INSTITUTION_ID', () => {
      process.env['INSTITUTION_ID'] = 'env-summary';
      mockSvc.getInstitutionSummary.mockReturnValue({});
      controller.getInstitutionSummary({ user: { sub: 'admin-1' } });
      expect(mockSvc.getInstitutionSummary).toHaveBeenCalledWith('env-summary');
      delete process.env['INSTITUTION_ID'];
    });

    it('falls back to default when no env or institutionId', () => {
      mockSvc.getInstitutionSummary.mockReturnValue({});
      controller.getInstitutionSummary({ user: { sub: 'admin-1' } });
      expect(mockSvc.getInstitutionSummary).toHaveBeenCalledWith('default');
    });
  });
});
