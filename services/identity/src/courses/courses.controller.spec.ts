import { Test, TestingModule } from '@nestjs/testing';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

const mockSvc = {
  getCourses: jest.fn(),
  enroll: jest.fn(),
  unenroll: jest.fn(),
  getResults: jest.fn(),
};

describe('CoursesController', () => {
  let controller: CoursesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CoursesController>(CoursesController);
  });

  it('getCourses delegates to service', () => {
    mockSvc.getCourses.mockReturnValue([]);
    expect(controller.getCourses()).toEqual([]);
  });

  it('enroll uses sapId from request user', () => {
    mockSvc.enroll.mockReturnValue({ message: 'Enrolled successfully' });
    controller.enroll('c1', { user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.enroll).toHaveBeenCalledWith('c1', 'SAP001');
  });

  it('enroll falls back to sub when sapId is absent', () => {
    mockSvc.enroll.mockReturnValue({ message: 'Enrolled successfully' });
    controller.enroll('c1', { user: { sub: 'u1' } });
    expect(mockSvc.enroll).toHaveBeenCalledWith('c1', 'u1');
  });

  it('enroll falls back to UNKNOWN when user is absent', () => {
    mockSvc.enroll.mockReturnValue({ message: 'Enrolled successfully' });
    controller.enroll('c1', {});
    expect(mockSvc.enroll).toHaveBeenCalledWith('c1', 'UNKNOWN');
  });

  it('unenroll uses sapId from request user', () => {
    mockSvc.unenroll.mockReturnValue({ message: 'Unenrolled successfully' });
    controller.unenroll('c1', { user: { sapId: 'SAP001' } });
    expect(mockSvc.unenroll).toHaveBeenCalledWith('c1', 'SAP001');
  });

  it('getResults delegates with usn param', () => {
    const mockResult = { usn: 'USN001', cgpa: 8.5, semesters: [] };
    mockSvc.getResults.mockReturnValue(mockResult);
    expect(controller.getResults('USN001')).toBe(mockResult);
    expect(mockSvc.getResults).toHaveBeenCalledWith('USN001');
  });
});
