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
  getAllAssignments: jest.fn(),
  getAssignmentsByCourse: jest.fn(),
  getAssignmentById: jest.fn(),
  submitAssignment: jest.fn(),
  gradeSubmissionById: jest.fn(),
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

  describe('getAllAssignments()', () => {
    it('delegates to service', () => {
      mockAssignmentsService.getAllAssignments.mockReturnValue([]);
      expect(controller.getAllAssignments()).toEqual([]);
    });
  });

  describe('getAssignmentsByCourse()', () => {
    it('delegates with courseId', () => {
      mockAssignmentsService.getAssignmentsByCourse.mockReturnValue([]);
      controller.getAssignmentsByCourse('course-1');
      expect(mockAssignmentsService.getAssignmentsByCourse).toHaveBeenCalledWith('course-1');
    });
  });

  describe('getStudentAssignmentsByUsn()', () => {
    it('delegates with usn param', () => {
      mockAssignmentsService.getStudentAssignments.mockReturnValue([]);
      controller.getStudentAssignmentsByUsn('USN001');
      expect(mockAssignmentsService.getStudentAssignments).toHaveBeenCalledWith('USN001');
    });
  });

  describe('getAssignmentDetail()', () => {
    it('delegates with id param', () => {
      mockAssignmentsService.getAssignmentById.mockReturnValue({ id: 'asn-1' });
      const result = controller.getAssignmentDetail('asn-1');
      expect(mockAssignmentsService.getAssignmentById).toHaveBeenCalledWith('asn-1');
      expect(result).toMatchObject({ id: 'asn-1' });
    });
  });

  describe('getSubmissionsById()', () => {
    it('delegates with id param', () => {
      mockAssignmentsService.getSubmissions.mockReturnValue([]);
      controller.getSubmissionsById('asn-2');
      expect(mockAssignmentsService.getSubmissions).toHaveBeenCalledWith('asn-2');
    });
  });

  describe('submitAssignment()', () => {
    it('uses sapId from request', () => {
      mockAssignmentsService.submitAssignment.mockReturnValue({ id: 'sub-1' });
      controller.submitAssignment('asn-1', { text: 'My answer' }, { user: { sapId: 'SAP001', sub: 'u1' } });
      expect(mockAssignmentsService.submitAssignment).toHaveBeenCalledWith('asn-1', 'SAP001', { text: 'My answer' });
    });

    it('falls back to sub when sapId absent', () => {
      mockAssignmentsService.submitAssignment.mockReturnValue({ id: 'sub-2' });
      controller.submitAssignment('asn-1', { text: 'ans' }, { user: { sub: 'u2' } });
      expect(mockAssignmentsService.submitAssignment).toHaveBeenCalledWith('asn-1', 'u2', { text: 'ans' });
    });

    it('falls back to UNKNOWN when user absent', () => {
      mockAssignmentsService.submitAssignment.mockReturnValue({ id: 'sub-3' });
      controller.submitAssignment('asn-1', {}, {});
      expect(mockAssignmentsService.submitAssignment).toHaveBeenCalledWith('asn-1', 'UNKNOWN', {});
    });
  });

  describe('gradeSubmissionById()', () => {
    it('delegates with submissionId and body', () => {
      mockAssignmentsService.gradeSubmissionById.mockReturnValue({ ok: true });
      controller.gradeSubmissionById('sub-1', { marks: 10, feedback: 'OK' });
      expect(mockAssignmentsService.gradeSubmissionById).toHaveBeenCalledWith('sub-1', 10, 'OK');
    });
  });
});
