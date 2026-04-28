import { Test, TestingModule } from '@nestjs/testing';
import { FeesApiController } from './fees-api.controller';
import { FeesApiService } from './fees-api.service';

const mockSvc = {
  getStudentFees: jest.fn(),
  getFeeHistory: jest.fn(),
  getFeeSummary: jest.fn(),
};

describe('FeesApiController', () => {
  let controller: FeesApiController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeesApiController],
      providers: [{ provide: FeesApiService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../roles/roles.guard').RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FeesApiController>(FeesApiController);
  });

  it('getStudentFees delegates to service with usn param', () => {
    const summary = { totalDue: 100000, totalOutstanding: 50000, items: [] };
    mockSvc.getStudentFees.mockReturnValue(summary);
    const result = controller.getStudentFees('USN001');
    expect(mockSvc.getStudentFees).toHaveBeenCalledWith('USN001');
    expect(result).toBe(summary);
  });

  it('getFeeHistory delegates to service with usn param', () => {
    const history = [{ id: 'h-1', date: '2024-01-01', amount: 45000, status: 'PAID', description: 'Tuition Fee - Semester 5' }];
    mockSvc.getFeeHistory.mockReturnValue(history);
    const result = controller.getFeeHistory('USN001');
    expect(mockSvc.getFeeHistory).toHaveBeenCalledWith('USN001');
    expect(result).toBe(history);
  });

  it('getFeeSummary delegates to service with usn param', () => {
    const summary = { totalDue: 50000, totalPaid: 30000, nextDue: '2024-06-01', overdueCount: 0 };
    mockSvc.getFeeSummary.mockReturnValue(summary);
    const result = controller.getFeeSummary('USN001');
    expect(mockSvc.getFeeSummary).toHaveBeenCalledWith('USN001');
    expect(result).toBe(summary);
  });
});
