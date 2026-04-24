import { Test, TestingModule } from '@nestjs/testing';
import { AdminPortalController } from './admin-portal.controller';
import { AdminPortalService } from './admin-portal.service';

const mockSvc = {
  getDashboard: jest.fn(),
  getReports: jest.fn(),
  getNaac: jest.fn(),
  triggerBulkImport: jest.fn(),
};

describe('AdminPortalController', () => {
  let controller: AdminPortalController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPortalController],
      providers: [{ provide: AdminPortalService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminPortalController>(AdminPortalController);
  });

  it('getDashboard delegates to service and returns dashboard', () => {
    const dashboard = { totalStudents: 450, totalFaculty: 35 };
    mockSvc.getDashboard.mockReturnValue(dashboard);
    expect(controller.getDashboard()).toBe(dashboard);
  });

  it('getReports delegates to service', () => {
    mockSvc.getReports.mockReturnValue([]);
    expect(controller.getReports()).toEqual([]);
  });

  it('getNaac delegates to service', () => {
    const naac = { overallScore: 3.12 };
    mockSvc.getNaac.mockReturnValue(naac);
    expect(controller.getNaac()).toBe(naac);
  });

  it('triggerBulkImport delegates with entityType and fileUrl', () => {
    const result = { jobId: 'bulk-1', status: 'QUEUED' };
    mockSvc.triggerBulkImport.mockReturnValue(result);
    const response = controller.triggerBulkImport({ entityType: 'students', fileUrl: 'https://example.com/file.csv' });
    expect(mockSvc.triggerBulkImport).toHaveBeenCalledWith('students', 'https://example.com/file.csv');
    expect(response).toBe(result);
  });
});
