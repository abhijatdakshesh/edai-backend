import { Test, TestingModule } from '@nestjs/testing';
import { StudentPortalController } from './student-portal.controller';
import { StudentPortalService } from './student-portal.service';

const mockSvc = {
  getDashboard: jest.fn(),
  getSchedule: jest.fn(),
  getHostel: jest.fn(),
  getExamPrep: jest.fn(),
  getStaff: jest.fn(),
};

describe('StudentPortalController', () => {
  let controller: StudentPortalController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentPortalController],
      providers: [{ provide: StudentPortalService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StudentPortalController>(StudentPortalController);
  });

  it('getDashboard uses sapId from request', () => {
    mockSvc.getDashboard.mockReturnValue({});
    controller.getDashboard({ user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.getDashboard).toHaveBeenCalledWith('SAP001');
  });

  it('getDashboard falls back to sub when sapId absent', () => {
    mockSvc.getDashboard.mockReturnValue({});
    controller.getDashboard({ user: { sub: 'u1' } });
    expect(mockSvc.getDashboard).toHaveBeenCalledWith('u1');
  });

  it('getDashboard falls back to UNKNOWN when user absent', () => {
    mockSvc.getDashboard.mockReturnValue({});
    controller.getDashboard({});
    expect(mockSvc.getDashboard).toHaveBeenCalledWith('UNKNOWN');
  });

  it('getSchedule delegates with usn', () => {
    mockSvc.getSchedule.mockReturnValue({ schedule: [] });
    controller.getSchedule({ user: { sapId: 'SAP001' } });
    expect(mockSvc.getSchedule).toHaveBeenCalledWith('SAP001');
  });

  it('getHostel delegates with usn', () => {
    mockSvc.getHostel.mockReturnValue({});
    controller.getHostel({ user: { sub: 'u1' } });
    expect(mockSvc.getHostel).toHaveBeenCalledWith('u1');
  });

  it('getExamPrep delegates with usn', () => {
    mockSvc.getExamPrep.mockReturnValue({});
    controller.getExamPrep({ user: { sub: 'u1' } });
    expect(mockSvc.getExamPrep).toHaveBeenCalledWith('u1');
  });

  it('getStaff delegates to service', () => {
    mockSvc.getStaff.mockReturnValue([]);
    expect(controller.getStaff()).toEqual([]);
  });

  it('getInstitutionStaff delegates to getStaff', () => {
    mockSvc.getStaff.mockReturnValue([{ name: 'Dr. Ram' }]);
    expect(controller.getInstitutionStaff()).toHaveLength(1);
  });
});
