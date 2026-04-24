import { Test, TestingModule } from '@nestjs/testing';
import { ClassesApiController } from './classes-api.controller';
import { ClassesApiService } from './classes-api.service';

const mockSvc = {
  getTeacherClasses: jest.fn(),
  getTeacherDashboard: jest.fn(),
  getAllClasses: jest.fn(),
};

describe('ClassesApiController', () => {
  let controller: ClassesApiController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassesApiController],
      providers: [{ provide: ClassesApiService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ClassesApiController>(ClassesApiController);
  });

  it('getTeacherClasses uses sub from request', () => {
    mockSvc.getTeacherClasses.mockReturnValue([]);
    controller.getTeacherClasses({ user: { sub: 'teacher-1' } });
    expect(mockSvc.getTeacherClasses).toHaveBeenCalledWith('teacher-1');
  });

  it('getTeacherClasses falls back to unknown when sub absent', () => {
    mockSvc.getTeacherClasses.mockReturnValue([]);
    controller.getTeacherClasses({ user: {} });
    expect(mockSvc.getTeacherClasses).toHaveBeenCalledWith('unknown');
  });

  it('getTeacherDashboard delegates with teacherId', () => {
    const dashboard = { totalStudents: 60 };
    mockSvc.getTeacherDashboard.mockReturnValue(dashboard);
    const result = controller.getTeacherDashboard({ user: { sub: 'teacher-1' } });
    expect(mockSvc.getTeacherDashboard).toHaveBeenCalledWith('teacher-1');
    expect(result).toBe(dashboard);
  });

  it('getAllClasses delegates to service', () => {
    mockSvc.getAllClasses.mockReturnValue([]);
    expect(controller.getAllClasses()).toEqual([]);
  });
});
