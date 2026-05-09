import { Test, TestingModule } from '@nestjs/testing';
import { VtuController } from './vtu.controller';
import { VtuService } from './vtu.service';
import { EventsGateway } from '../events/events.gateway';
import { VtuNotificationsService } from './vtu-notifications.service';

const mockSvc = {
  getAllWindows: jest.fn(),
  getActiveWindow: jest.fn(),
  createWindow: jest.fn(),
  getStudentStatus: jest.fn(),
  registerStudent: jest.fn(),
  getPendingStudents: jest.fn(),
  getDeptOverview: jest.fn(),
  sendReminders: jest.fn(),
  runEligibility: jest.fn(),
};

const mockEvents = { emitVtuWindowOpened: jest.fn() };

const mockNotifications = {
  notifyWindowOpened: jest.fn(),
  notifyEligibilityResults: jest.fn(),
  sendReminder: jest.fn(),
  sendBulkReminders: jest.fn(),
};

describe('VtuController', () => {
  let controller: VtuController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VtuController],
      providers: [
        { provide: VtuService, useValue: mockSvc },
        { provide: EventsGateway, useValue: mockEvents },
        { provide: VtuNotificationsService, useValue: mockNotifications },
      ],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<VtuController>(VtuController);
  });

  it('getAllWindows delegates to service', () => {
    mockSvc.getAllWindows.mockReturnValue([]);
    expect(controller.getAllWindows()).toEqual([]);
  });

  it('getActiveWindow delegates to service', () => {
    mockSvc.getActiveWindow.mockReturnValue(null);
    expect(controller.getActiveWindow()).toBeNull();
  });

  it('createWindow calls service and emits event', () => {
    const win = { id: 'win-1', title: 'Test', isActive: true };
    mockSvc.createWindow.mockReturnValue(win);
    const body = { title: 'Test', openDate: '2026-10-01', closeDate: '2026-10-15', semester: 5 };
    const result = controller.createWindow(body);
    expect(mockSvc.createWindow).toHaveBeenCalledWith(body);
    expect(mockEvents.emitVtuWindowOpened).toHaveBeenCalledWith({ windowId: 'win-1', title: 'Test' });
    expect(result).toBe(win);
  });

  it('getStudentStatus uses sapId from request', () => {
    mockSvc.getStudentStatus.mockReturnValue({});
    controller.getStudentStatus('win-1', { user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.getStudentStatus).toHaveBeenCalledWith('SAP001', 'win-1');
  });

  it('getStudentStatus falls back to sub when sapId absent', () => {
    mockSvc.getStudentStatus.mockReturnValue({});
    controller.getStudentStatus('win-1', { user: { sub: 'u1' } });
    expect(mockSvc.getStudentStatus).toHaveBeenCalledWith('u1', 'win-1');
  });

  it('registerStudent uses sapId from request', () => {
    mockSvc.registerStudent.mockReturnValue({});
    controller.registerStudent({ windowId: 'win-1', subjectCodes: ['CS301'] }, { user: { sapId: 'SAP001' } });
    expect(mockSvc.registerStudent).toHaveBeenCalledWith('SAP001', 'win-1', ['CS301']);
  });

  it('getPendingStudents delegates with windowId', () => {
    mockSvc.getPendingStudents.mockReturnValue([]);
    controller.getPendingStudents('win-1');
    expect(mockSvc.getPendingStudents).toHaveBeenCalledWith('win-1');
  });

  it('getDeptOverview delegates with windowId', () => {
    mockSvc.getDeptOverview.mockReturnValue([]);
    controller.getDeptOverview('win-1');
    expect(mockSvc.getDeptOverview).toHaveBeenCalledWith('win-1');
  });

  it('sendReminders delegates with windowId and usnList', () => {
    mockSvc.sendReminders.mockReturnValue({ reminded: [] });
    controller.sendReminders({ windowId: 'win-1', usnList: ['U1', 'U2'] });
    expect(mockSvc.sendReminders).toHaveBeenCalledWith('win-1', ['U1', 'U2']);
  });

  it('runEligibility delegates with windowId', () => {
    mockSvc.runEligibility.mockReturnValue({ processed: 5 });
    controller.runEligibility({ windowId: 'win-1' });
    expect(mockSvc.runEligibility).toHaveBeenCalledWith('win-1');
  });

  it('getChildVtuStatus delegates with usn param and windowId', () => {
    mockSvc.getStudentStatus.mockReturnValue({});
    controller.getChildVtuStatus('USN001', 'win-1');
    expect(mockSvc.getStudentStatus).toHaveBeenCalledWith('USN001', 'win-1');
  });

  it('getStudentStatus falls back to UNKNOWN when user absent', () => {
    mockSvc.getStudentStatus.mockReturnValue({});
    controller.getStudentStatus('win-1', {});
    expect(mockSvc.getStudentStatus).toHaveBeenCalledWith('UNKNOWN', 'win-1');
  });

  it('registerStudent falls back to sub when sapId absent', () => {
    mockSvc.registerStudent.mockReturnValue({});
    controller.registerStudent({ windowId: 'win-1', subjectCodes: ['CS301'] }, { user: { sub: 'u2' } });
    expect(mockSvc.registerStudent).toHaveBeenCalledWith('u2', 'win-1', ['CS301']);
  });

  it('registerStudent falls back to UNKNOWN when user absent', () => {
    mockSvc.registerStudent.mockReturnValue({});
    controller.registerStudent({ windowId: 'win-1', subjectCodes: [] }, {});
    expect(mockSvc.registerStudent).toHaveBeenCalledWith('UNKNOWN', 'win-1', []);
  });
});
