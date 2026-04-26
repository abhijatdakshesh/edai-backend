import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceApiController } from './attendance-api.controller';
import { AttendanceApiService } from './attendance-api.service';
import { EventsGateway } from '../events/events.gateway';

const mockSvc = {
  getStudentAttendanceSummary: jest.fn(),
  getStudentAttendance: jest.fn(),
  getClassAttendanceSummary: jest.fn(),
  getAtRiskStudents: jest.fn(),
  markBulk: jest.fn(),
  getTeacherSummary: jest.fn(),
  getClassStudents: jest.fn(),
  getAuditLog: jest.fn(),
  correctRecord: jest.fn(),
};

const mockEvents = {
  emitAttendanceUpdate: jest.fn(),
};

describe('AttendanceApiController', () => {
  let controller: AttendanceApiController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceApiController],
      providers: [
        { provide: AttendanceApiService, useValue: mockSvc },
        { provide: EventsGateway, useValue: mockEvents },
      ],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AttendanceApiController>(AttendanceApiController);
  });

  it('getStudentAttendanceSummary delegates to service', () => {
    mockSvc.getStudentAttendanceSummary.mockReturnValue([]);
    const result = controller.getStudentAttendanceSummary('USN001');
    expect(mockSvc.getStudentAttendanceSummary).toHaveBeenCalledWith('USN001');
    expect(result).toEqual([]);
  });

  it('getStudentAttendance delegates to service', () => {
    const summary = { overall: 80, subjects: [] };
    mockSvc.getStudentAttendance.mockReturnValue(summary);
    expect(controller.getStudentAttendance('USN001')).toBe(summary);
  });

  it('getClassAttendanceSummary delegates to service', () => {
    const summary = { classId: 'c1', present: 10, absent: 2 };
    mockSvc.getClassAttendanceSummary.mockReturnValue(summary);
    expect(controller.getClassAttendanceSummary('c1')).toBe(summary);
  });

  it('getAtRiskStudents delegates to service', () => {
    mockSvc.getAtRiskStudents.mockReturnValue([]);
    expect(controller.getAtRiskStudents('c1')).toEqual([]);
  });

  describe('markBulkAlt()', () => {
    it('maps PRESENT/ABSENT/LATE to P/A/L, calls service, and emits event', () => {
      const entries = [
        { studentUsn: 'U1', status: 'PRESENT' as const },
        { studentUsn: 'U2', status: 'ABSENT' as const },
        { studentUsn: 'U3', status: 'LATE' as const },
      ];
      const body = { classId: 'c1', date: '2026-04-20', entries };
      const req = { user: { sub: 'teacher-1' } };
      mockSvc.markBulk.mockReturnValue([]);

      controller.markBulkAlt(body, req);
      expect(mockSvc.markBulk).toHaveBeenCalledWith(
        'c1',
        '2026-04-20',
        [
          { usn: 'U1', status: 'P' },
          { usn: 'U2', status: 'A' },
          { usn: 'U3', status: 'L' },
        ],
        'teacher-1',
      );
      expect(mockEvents.emitAttendanceUpdate).toHaveBeenCalledWith({ classId: 'c1', date: '2026-04-20' });
    });

    it('falls back to unknown when user is missing', () => {
      const body = { classId: 'c1', date: '2026-04-20', entries: [] };
      mockSvc.markBulk.mockReturnValue([]);
      controller.markBulkAlt(body, {});
      expect(mockSvc.markBulk).toHaveBeenCalledWith('c1', '2026-04-20', [], 'unknown');
    });
  });

  describe('markBulk()', () => {
    it('delegates records directly, calls service, and emits event', () => {
      const body = { classId: 'c1', date: '2026-04-20', records: [{ usn: 'U1', status: 'P' as const }] };
      const req = { user: { sub: 'teacher-1' } };
      mockSvc.markBulk.mockReturnValue([]);

      controller.markBulk(body, req);
      expect(mockSvc.markBulk).toHaveBeenCalledWith('c1', '2026-04-20', body.records, 'teacher-1');
      expect(mockEvents.emitAttendanceUpdate).toHaveBeenCalled();
    });
  });

  it('getTeacherSummary uses sub from request', () => {
    mockSvc.getTeacherSummary.mockReturnValue([]);
    controller.getTeacherSummary({ user: { sub: 'teacher-X' } });
    expect(mockSvc.getTeacherSummary).toHaveBeenCalledWith('teacher-X');
  });

  it('getClassStudents delegates with id param', () => {
    mockSvc.getClassStudents.mockReturnValue([]);
    controller.getClassStudents('class-1');
    expect(mockSvc.getClassStudents).toHaveBeenCalledWith('class-1');
  });

  it('getAuditLog delegates to service', () => {
    mockSvc.getAuditLog.mockReturnValue([]);
    expect(controller.getAuditLog()).toEqual([]);
  });

  it('correctRecord delegates with id, status, editedBy', () => {
    const mockRecord = { id: 'r1', status: 'P' };
    mockSvc.correctRecord.mockReturnValue(mockRecord);
    const result = controller.correctRecord('r1', { status: 'P' }, { user: { sub: 'admin-1' } });
    expect(mockSvc.correctRecord).toHaveBeenCalledWith('r1', 'P', 'admin-1');
    expect(result).toBe(mockRecord);
  });

  it('markBulk falls back to unknown when user absent', () => {
    const body = { classId: 'c2', date: '2026-04-20', records: [] };
    mockSvc.markBulk.mockReturnValue([]);
    controller.markBulk(body, {});
    expect(mockSvc.markBulk).toHaveBeenCalledWith('c2', '2026-04-20', [], 'unknown');
  });

  it('getTeacherSummary falls back to unknown when user absent', () => {
    mockSvc.getTeacherSummary.mockReturnValue([]);
    controller.getTeacherSummary({});
    expect(mockSvc.getTeacherSummary).toHaveBeenCalledWith('unknown');
  });

  it('correctRecord falls back to unknown when user absent', () => {
    mockSvc.correctRecord.mockReturnValue({ id: 'r2', status: 'A' });
    controller.correctRecord('r2', { status: 'A' }, {});
    expect(mockSvc.correctRecord).toHaveBeenCalledWith('r2', 'A', 'unknown');
  });
});
