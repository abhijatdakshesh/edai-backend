import { Test, TestingModule } from '@nestjs/testing';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';
import { StudentPortalService } from '../student-portal/student-portal.service';

const mockCommsService = {
  getRecentCalls: jest.fn(),
  getParentCalls: jest.fn(),
  getParentMessages: jest.fn(),
  getAdminCallLogs: jest.fn(),
};

const mockStudentPortalService = {
  getDashboard: jest.fn(),
  getSchedule: jest.fn(),
  getHostel: jest.fn(),
  getExamPrep: jest.fn(),
  getStaff: jest.fn(),
};

describe('CommsController', () => {
  let controller: CommsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommsController],
      providers: [
        { provide: CommsService, useValue: mockCommsService },
        { provide: StudentPortalService, useValue: mockStudentPortalService },
      ],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CommsController>(CommsController);
  });

  it('getRecentCalls delegates to service', () => {
    mockCommsService.getRecentCalls.mockReturnValue([]);
    expect(controller.getRecentCalls()).toEqual([]);
    expect(mockCommsService.getRecentCalls).toHaveBeenCalled();
  });

  it('getParentCalls delegates with parentId query param', () => {
    mockCommsService.getParentCalls.mockReturnValue([]);
    controller.getParentCalls('parent-1');
    expect(mockCommsService.getParentCalls).toHaveBeenCalledWith('parent-1');
  });

  it('getParentMessages delegates with parentId query param', () => {
    mockCommsService.getParentMessages.mockReturnValue([]);
    controller.getParentMessages('parent-1');
    expect(mockCommsService.getParentMessages).toHaveBeenCalledWith('parent-1');
  });

  it('getAdminCallLogs delegates to service', () => {
    mockCommsService.getAdminCallLogs.mockReturnValue([]);
    expect(controller.getAdminCallLogs()).toEqual([]);
  });
});
