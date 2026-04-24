/**
 * attendance.controller.spec.ts
 *
 * Tests that AttendanceController delegates every route handler call
 * correctly to AttendanceService — no business logic lives in the controller.
 *
 * Strategy
 * ─────────
 * - Create a NestJS testing module with a fully-mocked AttendanceService.
 * - Assert that the controller method calls the correct service method with
 *   the exact arguments and forwards the return value.
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import {
  MarkAttendanceDto,
  MarkBulkAttendanceDto,
  ExcuseAbsenceDto,
} from '../dto/attendance.dto';

// ─── Mock service factory ────────────────────────────────────────────────────

const mockService = {
  markAttendance: jest.fn(),
  markBulk: jest.fn(),
  getStudentSummary: jest.fn(),
  getClassToday: jest.fn(),
  getAbsenteesToday: jest.fn(),
  getAtRisk: jest.fn(),
  getClassSummary: jest.fn(),
  getClassAtRisk: jest.fn(),
  getVtuEligibility: jest.fn(),
  runEscalationEngine: jest.fn(),
  excuseAbsence: jest.fn(),
};

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

const markDto: MarkAttendanceDto = {
  studentId: 'stu-001',
  classId: 'cls-CS101',
  subjectId: 'sub-MATH',
  date: TODAY,
  period: 1,
  status: 'PRESENT',
  markedBy: 'teacher-001',
};

const bulkDto: MarkBulkAttendanceDto = {
  classId: 'cls-CS101',
  date: TODAY,
  period: 1,
  subjectId: 'sub-MATH',
  markedBy: 'teacher-001',
  records: [
    { studentId: 'stu-001', status: 'PRESENT' },
    { studentId: 'stu-002', status: 'ABSENT' },
  ],
};

const excuseDto: ExcuseAbsenceDto = { reason: 'Medical leave' };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AttendanceController', () => {
  let controller: AttendanceController;

  beforeEach(async () => {
    // Reset all mock call history before each test
    Object.values(mockService).forEach((fn) => (fn as jest.Mock).mockReset());

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        {
          provide: AttendanceService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AttendanceController>(AttendanceController);
  });

  // ── POST /attendance/mark ──────────────────────────────────────────────────

  describe('markAttendance', () => {
    it('delegates to service.markAttendance with the dto', async () => {
      const expected = { recordId: 'abc-123', callScheduled: false };
      mockService.markAttendance.mockResolvedValue(expected);

      const result = controller.markAttendance(markDto);

      expect(mockService.markAttendance).toHaveBeenCalledTimes(1);
      expect(mockService.markAttendance).toHaveBeenCalledWith(markDto);
      await expect(result).resolves.toEqual(expected);
    });

    it('forwards ABSENT dto and returns callScheduled:true', async () => {
      const absentDto: MarkAttendanceDto = { ...markDto, status: 'ABSENT' };
      const expected = { recordId: 'xyz-789', callScheduled: true };
      mockService.markAttendance.mockResolvedValue(expected);

      await expect(controller.markAttendance(absentDto)).resolves.toEqual(expected);
      expect(mockService.markAttendance).toHaveBeenCalledWith(absentDto);
    });
  });

  // ── POST /attendance/mark/bulk ─────────────────────────────────────────────

  describe('markBulk', () => {
    it('delegates to service.markBulk with the bulk dto', async () => {
      const expected = { processed: 2, absentCount: 1 };
      mockService.markBulk.mockResolvedValue(expected);

      const result = controller.markBulk(bulkDto);

      expect(mockService.markBulk).toHaveBeenCalledTimes(1);
      expect(mockService.markBulk).toHaveBeenCalledWith(bulkDto);
      await expect(result).resolves.toEqual(expected);
    });
  });

  // ── GET /attendance/students/:id/summary ──────────────────────────────────

  describe('getStudentSummary', () => {
    it('delegates to service.getStudentSummary with the student id', async () => {
      const expected = {
        studentId: 'stu-001',
        total: 10,
        present: 8,
        absent: 2,
        percentage: 80,
      };
      mockService.getStudentSummary.mockResolvedValue(expected);

      const result = controller.getStudentSummary('stu-001');

      expect(mockService.getStudentSummary).toHaveBeenCalledWith('stu-001');
      await expect(result).resolves.toEqual(expected);
    });
  });

  // ── GET /attendance/classes/:id/today ─────────────────────────────────────

  describe('getClassToday', () => {
    it('delegates to service.getClassToday with the class id', async () => {
      const expected = [{ id: 'rec-1', studentId: 'stu-001', status: 'PRESENT' }];
      mockService.getClassToday.mockResolvedValue(expected);

      const result = controller.getClassToday('cls-CS101');

      expect(mockService.getClassToday).toHaveBeenCalledWith('cls-CS101');
      await expect(result).resolves.toEqual(expected);
    });

    it('returns empty array when service returns empty array', async () => {
      mockService.getClassToday.mockResolvedValue([]);
      await expect(controller.getClassToday('cls-empty')).resolves.toEqual([]);
    });
  });

  // ── GET /attendance/classes/:id/absentees ─────────────────────────────────

  describe('getAbsenteesToday', () => {
    it('delegates to service.getAbsenteesToday with the class id', async () => {
      const expected = [{ id: 'rec-2', studentId: 'stu-002', status: 'ABSENT' }];
      mockService.getAbsenteesToday.mockResolvedValue(expected);

      const result = controller.getAbsenteesToday('cls-CS101');

      expect(mockService.getAbsenteesToday).toHaveBeenCalledWith('cls-CS101');
      await expect(result).resolves.toEqual(expected);
    });
  });

  // ── GET /attendance/at-risk ───────────────────────────────────────────────

  describe('getAtRisk', () => {
    it('delegates to service.getAtRisk with undefined when no query param', async () => {
      const expected = [{ studentId: 'stu-risky', absenceCount: 4 }];
      mockService.getAtRisk.mockResolvedValue(expected);

      const result = controller.getAtRisk(undefined);

      expect(mockService.getAtRisk).toHaveBeenCalledWith(undefined);
      await expect(result).resolves.toEqual(expected);
    });

    it('forwards institutionId query param to service', async () => {
      mockService.getAtRisk.mockResolvedValue([]);

      await controller.getAtRisk('rvce');

      expect(mockService.getAtRisk).toHaveBeenCalledWith('rvce');
    });
  });

  // ── GET /attendance/classes/:id/summary ───────────────────────────────────

  describe('getClassSummary', () => {
    it('delegates to service.getClassSummary with the class id', async () => {
      const expected = {
        classId: 'cls-CS101',
        total: 30,
        present: 25,
        absent: 3,
        late: 2,
        pct: 83,
      };
      mockService.getClassSummary.mockResolvedValue(expected);

      const result = controller.getClassSummary('cls-CS101');

      expect(mockService.getClassSummary).toHaveBeenCalledWith('cls-CS101');
      await expect(result).resolves.toEqual(expected);
    });
  });

  // ── GET /attendance/classes/:id/at-risk ───────────────────────────────────

  describe('getClassAtRisk', () => {
    it('delegates to service.getClassAtRisk with the class id', async () => {
      const expected = [
        { studentId: 'stu-risky', absencePct: 80, consecutiveAbsences: 3 },
      ];
      mockService.getClassAtRisk.mockResolvedValue(expected);

      const result = controller.getClassAtRisk('cls-CS101');

      expect(mockService.getClassAtRisk).toHaveBeenCalledWith('cls-CS101');
      await expect(result).resolves.toEqual(expected);
    });

    it('returns empty array when all students are safe', async () => {
      mockService.getClassAtRisk.mockResolvedValue([]);
      await expect(controller.getClassAtRisk('cls-safe')).resolves.toEqual([]);
    });
  });

  // ── GET /attendance/students/:usn/vtu-eligibility ─────────────────────────

  describe('getVtuEligibility', () => {
    it('delegates to service.getVtuEligibility with the USN', async () => {
      const expected = [
        {
          subjectId: 'sub-MATH',
          totalClasses: 40,
          attended: 32,
          pct: 80,
          eligible: true,
          canMissMore: 2,
          mustAttend: 0,
        },
      ];
      mockService.getVtuEligibility.mockResolvedValue(expected);

      const result = controller.getVtuEligibility('1RV21CS001');

      expect(mockService.getVtuEligibility).toHaveBeenCalledWith('1RV21CS001');
      await expect(result).resolves.toEqual(expected);
    });

    it('returns empty array when student has no records', async () => {
      mockService.getVtuEligibility.mockResolvedValue([]);
      await expect(controller.getVtuEligibility('ghost-usn')).resolves.toEqual([]);
    });

    it('passes USN exactly as received (case-sensitive)', async () => {
      mockService.getVtuEligibility.mockResolvedValue([]);
      await controller.getVtuEligibility('1rv21cs001');
      expect(mockService.getVtuEligibility).toHaveBeenCalledWith('1rv21cs001');
    });
  });

  // ── POST /attendance/escalation/run ───────────────────────────────────────

  describe('runEscalation', () => {
    it('delegates to service.runEscalationEngine', async () => {
      mockService.runEscalationEngine.mockResolvedValue(undefined);

      const result = controller.runEscalation();

      expect(mockService.runEscalationEngine).toHaveBeenCalledTimes(1);
      expect(mockService.runEscalationEngine).toHaveBeenCalledWith();
      await expect(result).resolves.toBeUndefined();
    });
  });

  // ── PUT /attendance/records/:id/excuse ────────────────────────────────────

  describe('excuseAbsence', () => {
    it('delegates to service.excuseAbsence with recordId and reason', async () => {
      const expected = {
        id: 'rec-999',
        status: 'EXCUSED',
        absenceReason: 'Medical leave',
      };
      mockService.excuseAbsence.mockResolvedValue(expected);

      const result = controller.excuseAbsence('rec-999', excuseDto);

      expect(mockService.excuseAbsence).toHaveBeenCalledWith('rec-999', 'Medical leave');
      await expect(result).resolves.toEqual(expected);
    });

    it('passes null through when record is not found', async () => {
      mockService.excuseAbsence.mockResolvedValue(null);

      await expect(
        controller.excuseAbsence('non-existent-id', excuseDto),
      ).resolves.toBeNull();
    });

    it('extracts reason from ExcuseAbsenceDto correctly', async () => {
      mockService.excuseAbsence.mockResolvedValue(null);
      const customExcuse: ExcuseAbsenceDto = { reason: 'Family bereavement' };
      await controller.excuseAbsence('rec-abc', customExcuse);
      expect(mockService.excuseAbsence).toHaveBeenCalledWith('rec-abc', 'Family bereavement');
    });
  });

  // ── Service is injected (DI sanity check) ─────────────────────────────────

  describe('dependency injection', () => {
    it('is defined', () => {
      expect(controller).toBeDefined();
    });

    it('holds a reference to AttendanceService', () => {
      // Access private field via casting to verify DI wiring
      expect((controller as any).svc).toBe(mockService);
    });
  });
});
