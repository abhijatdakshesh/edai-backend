import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

const mockSvc = {
  getJobs: jest.fn(),
  getJob: jest.fn(),
  apply: jest.fn(),
  withdraw: jest.fn(),
  getMyApplications: jest.fn(),
  getPredictions: jest.fn(),
  getPlacementSummary: jest.fn(),
  getPlacementStats: jest.fn(),
  getSkillGapReport: jest.fn(),
  getDrives: jest.fn(),
  getDrive: jest.fn(),
  createDrive: jest.fn(),
  completeDrive: jest.fn(),
  getAlumniOutcomes: jest.fn(),
  addAlumniOutcome: jest.fn(),
};

describe('JobsController', () => {
  let controller: JobsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: JobsService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../roles/roles.guard').RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<JobsController>(JobsController);
  });

  // ─── Job board ────────────────────────────────────────────────────────────

  it('getJobs delegates to service', () => {
    mockSvc.getJobs.mockReturnValue([]);
    expect(controller.getJobs()).toEqual([]);
  });

  it('getJob delegates id to service', () => {
    mockSvc.getJob.mockReturnValue({ id: 'j1' });
    expect(controller.getJob('j1')).toEqual({ id: 'j1' });
    expect(mockSvc.getJob).toHaveBeenCalledWith('j1');
  });

  it('apply uses sapId from request user', () => {
    mockSvc.apply.mockReturnValue({ message: 'Application submitted' });
    controller.apply('job-1', { user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.apply).toHaveBeenCalledWith('job-1', 'SAP001');
  });

  it('apply falls back to sub when sapId absent', () => {
    mockSvc.apply.mockReturnValue({ message: 'Application submitted' });
    controller.apply('job-1', { user: { sub: 'u1' } });
    expect(mockSvc.apply).toHaveBeenCalledWith('job-1', 'u1');
  });

  it('apply falls back to UNKNOWN when user absent', () => {
    mockSvc.apply.mockReturnValue({ message: 'Application submitted' });
    controller.apply('job-1', {});
    expect(mockSvc.apply).toHaveBeenCalledWith('job-1', 'UNKNOWN');
  });

  it('withdraw delegates applicationId to service', () => {
    mockSvc.withdraw.mockReturnValue({ withdrawn: true });
    controller.withdrawApplication('app-1');
    expect(mockSvc.withdraw).toHaveBeenCalledWith('app-1');
  });

  it('getMyApplications uses sapId', () => {
    mockSvc.getMyApplications.mockReturnValue([]);
    controller.getMyApplications({ user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.getMyApplications).toHaveBeenCalledWith('SAP001');
  });

  it('getMyApplications falls back to sub', () => {
    mockSvc.getMyApplications.mockReturnValue([]);
    controller.getMyApplications({ user: { sub: 'u1' } });
    expect(mockSvc.getMyApplications).toHaveBeenCalledWith('u1');
  });

  it('getMyApplications falls back to UNKNOWN', () => {
    mockSvc.getMyApplications.mockReturnValue([]);
    controller.getMyApplications({});
    expect(mockSvc.getMyApplications).toHaveBeenCalledWith('UNKNOWN');
  });

  // ─── Placement Intelligence ───────────────────────────────────────────────

  it('getPredictions delegates with dept and likelihood', () => {
    mockSvc.getPredictions.mockReturnValue([]);
    controller.getPredictions('CS', 'HIGH');
    expect(mockSvc.getPredictions).toHaveBeenCalledWith('CS', 'HIGH');
  });

  it('getPlacementSummary delegates to service', () => {
    mockSvc.getPlacementSummary.mockReturnValue({ placed: 10 });
    expect(controller.getPlacementSummary()).toEqual({ placed: 10 });
  });

  it('getPlacementStats delegates dept and academicYear', () => {
    mockSvc.getPlacementStats.mockReturnValue([]);
    controller.getPlacementStats('CS', '2024-25');
    expect(mockSvc.getPlacementStats).toHaveBeenCalledWith('CS', '2024-25');
  });

  it('getPlacementStats passes undefined when no params', () => {
    mockSvc.getPlacementStats.mockReturnValue([]);
    controller.getPlacementStats();
    expect(mockSvc.getPlacementStats).toHaveBeenCalledWith(undefined, undefined);
  });

  it('getSkillGapReport delegates dept to service', () => {
    mockSvc.getSkillGapReport.mockReturnValue([]);
    controller.getSkillGapReport('ECE');
    expect(mockSvc.getSkillGapReport).toHaveBeenCalledWith('ECE');
  });

  // ─── Drives ──────────────────────────────────────────────────────────────

  it('getDrives delegates status filter', () => {
    mockSvc.getDrives.mockReturnValue([]);
    controller.getDrives('SCHEDULED');
    expect(mockSvc.getDrives).toHaveBeenCalledWith('SCHEDULED');
  });

  it('getDrives passes undefined when no status', () => {
    mockSvc.getDrives.mockReturnValue([]);
    controller.getDrives();
    expect(mockSvc.getDrives).toHaveBeenCalledWith(undefined);
  });

  it('getDrive delegates id', () => {
    mockSvc.getDrive.mockReturnValue({ id: 'd1' });
    controller.getDrive('d1');
    expect(mockSvc.getDrive).toHaveBeenCalledWith('d1');
  });

  it('createDrive delegates body', () => {
    const body = { company: 'Infosys', dept: 'CS' } as any;
    mockSvc.createDrive.mockReturnValue({ id: 'd2', ...body });
    controller.createDrive(body);
    expect(mockSvc.createDrive).toHaveBeenCalledWith(body);
  });

  it('completeDrive delegates id and offersExtended', () => {
    mockSvc.completeDrive.mockReturnValue({ status: 'COMPLETED' });
    controller.completeDrive('d1', { offersExtended: 5 });
    expect(mockSvc.completeDrive).toHaveBeenCalledWith('d1', 5);
  });

  // ─── Alumni ──────────────────────────────────────────────────────────────

  it('getAlumni delegates dept and parsed graduationYear', () => {
    mockSvc.getAlumniOutcomes.mockReturnValue([]);
    controller.getAlumni('CS', '2024');
    expect(mockSvc.getAlumniOutcomes).toHaveBeenCalledWith('CS', 2024);
  });

  it('getAlumni passes undefined graduationYear when absent', () => {
    mockSvc.getAlumniOutcomes.mockReturnValue([]);
    controller.getAlumni('CS', undefined);
    expect(mockSvc.getAlumniOutcomes).toHaveBeenCalledWith('CS', undefined);
  });

  it('addAlumni delegates body to service', () => {
    const body = { usn: '1RV21CS001', company: 'Google' };
    mockSvc.addAlumniOutcome.mockReturnValue(body);
    controller.addAlumni(body);
    expect(mockSvc.addAlumniOutcome).toHaveBeenCalledWith(body);
  });
});
