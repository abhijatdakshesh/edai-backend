import { Test, TestingModule } from '@nestjs/testing';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { EventsGateway } from '../events/events.gateway';

const mockSvc = {
  getMarks: jest.fn(),
  saveMarks: jest.fn(),
  submitForReview: jest.fn(),
  getAllSubmissions: jest.fn(),
  confirm: jest.fn(),
  sendReminders: jest.fn(),
  uploadResults: jest.fn(),
  getMarksBySubject: jest.fn(),
};

const mockEvents = {
  emitIaSubmissionUpdated: jest.fn(),
};

describe('IaController', () => {
  let controller: IaController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IaController],
      providers: [
        { provide: IaService, useValue: mockSvc },
        { provide: EventsGateway, useValue: mockEvents },
      ],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<IaController>(IaController);
  });

  it('getMarks converts sem string to int and delegates', () => {
    mockSvc.getMarks.mockReturnValue([]);
    controller.getMarks('CS301', '5');
    expect(mockSvc.getMarks).toHaveBeenCalledWith('CS301', 5);
  });

  it('saveMarks delegates with teacherId from request', () => {
    mockSvc.saveMarks.mockReturnValue({ id: 'sub-1', status: 'DRAFT' });
    const body = { subjectCode: 'CS301', sem: 5, marks: [{ usn: 'U1', ia1: 18, ia2: 17, ia3: 19 }] };
    controller.saveMarks(body, { user: { sub: 'teacher-1' } });
    expect(mockSvc.saveMarks).toHaveBeenCalledWith('CS301', 5, body.marks, 'teacher-1');
  });

  it('submitForReview delegates with teacherId', () => {
    mockSvc.submitForReview.mockReturnValue({ status: 'SUBMITTED' });
    controller.submitForReview({ subjectCode: 'CS301', sem: 5 }, { user: { sub: 'teacher-1' } });
    expect(mockSvc.submitForReview).toHaveBeenCalledWith('CS301', 5, 'teacher-1');
  });

  it('getAllSubmissions delegates to service', () => {
    mockSvc.getAllSubmissions.mockReturnValue([]);
    expect(controller.getAllSubmissions()).toEqual([]);
  });

  it('confirm calls service and emits event', () => {
    const sub = { id: 'sub-1', status: 'CONFIRMED' };
    mockSvc.confirm.mockReturnValue(sub);
    const result = controller.confirm('sub-1');
    expect(mockSvc.confirm).toHaveBeenCalledWith('sub-1');
    expect(mockEvents.emitIaSubmissionUpdated).toHaveBeenCalledWith({ submissionId: 'sub-1', status: 'CONFIRMED' });
    expect(result).toBe(sub);
  });

  it('sendReminders delegates with teacherIds', () => {
    mockSvc.sendReminders.mockReturnValue({ reminded: ['t1'] });
    const result = controller.sendReminders({ teacherIds: ['t1'] });
    expect(result).toEqual({ reminded: ['t1'] });
  });

  it('uploadResults delegates with subjectCode and sem', () => {
    mockSvc.uploadResults.mockReturnValue({ message: 'queued' });
    controller.uploadResults({ subjectCode: 'CS301', sem: 5 });
    expect(mockSvc.uploadResults).toHaveBeenCalledWith('CS301', 5);
  });

  it('saveMarks falls back to unknown when user absent', () => {
    mockSvc.saveMarks.mockReturnValue({ id: 'sub-2', status: 'DRAFT' });
    controller.saveMarks({ subjectCode: 'CS301', sem: 5, marks: [] }, {});
    expect(mockSvc.saveMarks).toHaveBeenCalledWith('CS301', 5, [], 'unknown');
  });

  it('submitForReview falls back to unknown when user absent', () => {
    mockSvc.submitForReview.mockReturnValue({ status: 'SUBMITTED' });
    controller.submitForReview({ subjectCode: 'CS301', sem: 5 }, {});
    expect(mockSvc.submitForReview).toHaveBeenCalledWith('CS301', 5, 'unknown');
  });

  it('submitBySubjectId delegates with subjectId and teacherId from sub', () => {
    mockSvc.submitForReview.mockReturnValue({ status: 'SUBMITTED' });
    controller.submitBySubjectId('CS301', { user: { sub: 'teacher-2' } });
    expect(mockSvc.submitForReview).toHaveBeenCalledWith('CS301', 5, 'teacher-2');
  });

  it('submitBySubjectId falls back to unknown when user absent', () => {
    mockSvc.submitForReview.mockReturnValue({ status: 'SUBMITTED' });
    controller.submitBySubjectId('CS301', {});
    expect(mockSvc.submitForReview).toHaveBeenCalledWith('CS301', 5, 'unknown');
  });

  it('getMarksBySubject delegates with subjectId', () => {
    mockSvc.getMarksBySubject.mockReturnValue([]);
    controller.getMarksBySubject('CS301');
    expect(mockSvc.getMarksBySubject).toHaveBeenCalledWith('CS301');
  });

  it('bulkSaveMarks returns jobId and QUEUED status', () => {
    const body = { subjectCode: 'CS301', sem: 5, marks: [{ usn: 'U1', ia1: 18, ia2: 17, ia3: 19 }] };
    const result = controller.bulkSaveMarks(body, { user: { sub: 'teacher-1' } });
    expect(result.status).toBe('QUEUED');
    expect(result.count).toBe(1);
  });

  it('bulkSaveMarks falls back to unknown when user absent', () => {
    const body = { subjectCode: 'CS301', sem: 5, marks: [] };
    const result = controller.bulkSaveMarks(body, {});
    expect(result.status).toBe('QUEUED');
  });

  it('confirmBulkMarks returns ok with jobId and confirmedAt', () => {
    const result = controller.confirmBulkMarks({ jobId: 'bulk-1' });
    expect(result.ok).toBe(true);
    expect(result.jobId).toBe('bulk-1');
    expect(result.confirmedAt).toBeDefined();
  });
});
