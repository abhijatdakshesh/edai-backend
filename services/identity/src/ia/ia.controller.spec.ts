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
});
