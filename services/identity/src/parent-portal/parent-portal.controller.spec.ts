import { Test, TestingModule } from '@nestjs/testing';
import { ParentPortalController } from './parent-portal.controller';
import { ParentPortalService } from './parent-portal.service';

const mockSvc = {
  getDashboard: jest.fn(),
  getChildren: jest.fn(),
  getChildAttendance: jest.fn(),
  getChildResults: jest.fn(),
  getChildFees: jest.fn(),
};

describe('ParentPortalController', () => {
  let controller: ParentPortalController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParentPortalController],
      providers: [{ provide: ParentPortalService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ParentPortalController>(ParentPortalController);
  });

  it('getDashboard uses sub from request', () => {
    mockSvc.getDashboard.mockReturnValue({});
    controller.getDashboard({ user: { sub: 'parent-1' } });
    expect(mockSvc.getDashboard).toHaveBeenCalledWith('parent-1');
  });

  it('getDashboard falls back to unknown when sub absent', () => {
    mockSvc.getDashboard.mockReturnValue({});
    controller.getDashboard({ user: {} });
    expect(mockSvc.getDashboard).toHaveBeenCalledWith('unknown');
  });

  it('getChildren uses sub from request', () => {
    mockSvc.getChildren.mockReturnValue([]);
    controller.getChildren({ user: { sub: 'parent-1' } });
    expect(mockSvc.getChildren).toHaveBeenCalledWith('parent-1');
  });

  it('getChildAttendance delegates with usn param', () => {
    mockSvc.getChildAttendance.mockReturnValue({ overall: 80 });
    controller.getChildAttendance('USN001');
    expect(mockSvc.getChildAttendance).toHaveBeenCalledWith('USN001');
  });

  it('getChildResults delegates with usn param', () => {
    mockSvc.getChildResults.mockReturnValue({ cgpa: 8.5 });
    controller.getChildResults('USN001');
    expect(mockSvc.getChildResults).toHaveBeenCalledWith('USN001');
  });

  it('getChildFees delegates with usn param', () => {
    mockSvc.getChildFees.mockReturnValue({ totalDue: 0 });
    controller.getChildFees('USN001');
    expect(mockSvc.getChildFees).toHaveBeenCalledWith('USN001');
  });
});
