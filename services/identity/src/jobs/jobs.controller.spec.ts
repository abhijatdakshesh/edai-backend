import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

const mockSvc = {
  getJobs: jest.fn(),
  apply: jest.fn(),
  getPredictions: jest.fn(),
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
      .compile();

    controller = module.get<JobsController>(JobsController);
  });

  it('getJobs delegates to service', () => {
    mockSvc.getJobs.mockReturnValue([]);
    expect(controller.getJobs()).toEqual([]);
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

  it('getPredictions delegates with dept and likelihood query params', () => {
    mockSvc.getPredictions.mockReturnValue([]);
    controller.getPredictions('CS', 'HIGH');
    expect(mockSvc.getPredictions).toHaveBeenCalledWith('CS', 'HIGH');
  });
});
