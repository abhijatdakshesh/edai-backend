import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsApiController } from './assignments-api.controller';
import { AssignmentsApiService } from './assignments-api.service';
import { EventsGateway } from '../events/events.gateway';

const mockAssignmentsService = {
  getStudentAssignments: jest.fn(),
  getTeacherAssignments: jest.fn(),
  createAssignment: jest.fn(),
  publishAssignment: jest.fn(),
  getSubmissions: jest.fn(),
  gradeSubmission: jest.fn(),
};

const mockEventsGateway = {
  emitMarksUpdate: jest.fn(),
};

describe('AssignmentsApiController', () => {
  let controller: AssignmentsApiController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsApiController],
      providers: [
        { provide: AssignmentsApiService, useValue: mockAssignmentsService },
        { provide: EventsGateway, useValue: mockEventsGateway },
      ],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AssignmentsApiController>(AssignmentsApiController);
  });

  describe('getStudentAssignments()', () => {
    it('calls service with sapId from request user', () => {
      const req = { user: { sapId: 'SAP001', sub: 'u1' } };
      mockAssignmentsService.getStudentAssignments.mockReturnValue([]);
      const result = controller.getStudentAssignments(req);
      expect(mockAssignmentsService.getStudentAssignments).toHaveBeenCalledWith('SAP001');
      expect(result).toEqual([]);
    });

    it('falls back to sub when sapId is absent', () => {
      const req = { user: { sub: 'u1' } };
      mockAssignmentsService.getStudentAssignments.mockReturnValue([]);
      controller.getStudentAssignments(req);
      expect(mockAssignmentsService.getStudentAssignments).toHaveBeenCalledWith('u1');
    });

    it('uses UNKNOWN when user is absent', () => {
      mockAssignmentsService.getStudentAssignments.mockReturnValue([]);
      controller.getStudentAssignments({});
      expect(mockAssignmentsService.getStudentAssignments).toHaveBeenCalledWith('UNKNOWN');
    });
  });

  describe('getTeacherAssignments()', () => {
    it('calls service with sub from request user', () => {
      const req = { user: { sub: 'teacher-1' } };
      mockAssignmentsService.getTeacherAssignments.mockReturnValue([]);
      controller.getTeacherAssignments(req);
      expect(mockAssignmentsService.getTeacherAssignments).toHaveBeenCalledWith('teacher-1');
    });

    it('falls back to unknown when sub is absent', () => {
      mockAssignmentsService.getTeacherAssignments.mockReturnValue([]);
      controller.getTeacherAssignments({ user: {} });
      expect(mockAssignmentsService.getTeacherAssignments).toHaveBeenCalledWith('unknown');
    });
  });

  describe('createAssignment()', () => {
    it('delegates to service with body and teacherId', () => {
      const body = { title: 'T', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10 };
      const req = { user: { sub: 'teacher-1' } };
      const mockResult = { id: 'asn-1', ...body, status: 'DRAFT', teacherId: 'teacher-1' };
      mockAssignmentsService.createAssignment.mockReturnValue(mockResult);

      const result = controller.createAssignment(body, req);
      expect(mockAssignmentsService.createAssignment).toHaveBeenCalledWith(body, 'teacher-1');
      expect(result).toBe(mockResult);
    });
  });

  describe('publishAssignment()', () => {
    it('delegates to service with id param', () => {
      const mockResult = { id: 'asn-1', status: 'PUBLISHED' };
      mockAssignmentsService.publishAssignment.mockReturnValue(mockResult);
      const result = controller.publishAssignment('asn-1');
      expect(mockAssignmentsService.publishAssignment).toHaveBeenCalledWith('asn-1');
      expect(result).toBe(mockResult);
    });
  });

  describe('getSubmissions()', () => {
    it('delegates to service with id param', () => {
      mockAssignmentsService.getSubmissions.mockReturnValue([]);
      const result = controller.getSubmissions('asn-1');
      expect(mockAssignmentsService.getSubmissions).toHaveBeenCalledWith('asn-1');
      expect(result).toEqual([]);
    });
  });

  describe('gradeSubmission()', () => {
    it('grades submission and emits marks update event', () => {
      const mockSub = { id: 's1', assignmentId: 'asn-1', usn: 'U1', marks: 18, status: 'GRADED' };
      mockAssignmentsService.gradeSubmission.mockReturnValue(mockSub);

      const result = controller.gradeSubmission('asn-1', 'U1', { marks: 18, feedback: 'Good' });
      expect(mockAssignmentsService.gradeSubmission).toHaveBeenCalledWith('asn-1', 'U1', 18, 'Good');
      expect(mockEventsGateway.emitMarksUpdate).toHaveBeenCalledWith({ subjectCode: 'asn-1', sem: 0 });
      expect(result).toBe(mockSub);
    });
  });
});
