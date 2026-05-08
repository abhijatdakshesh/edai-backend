import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StudentPortalService } from './student-portal.service';
import { AttendanceApiService } from '../attendance-api/attendance-api.service';
import { AssignmentsApiService } from '../assignments-api/assignments-api.service';
import { FeesApiService } from '../fees-api/fees-api.service';
import { CoursesService } from '../courses/courses.service';

const mockAttendanceSvc = { getStudentAttendance: jest.fn() };
const mockAssignmentsSvc = { getStudentAssignments: jest.fn() };
const mockFeesSvc = { getStudentFees: jest.fn() };
const mockCoursesSvc = { getCourses: jest.fn(), getResults: jest.fn() };

describe('StudentPortalService', () => {
  let service: StudentPortalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentPortalService,
        { provide: AttendanceApiService, useValue: mockAttendanceSvc },
        { provide: AssignmentsApiService, useValue: mockAssignmentsSvc },
        { provide: FeesApiService, useValue: mockFeesSvc },
        { provide: CoursesService, useValue: mockCoursesSvc },
      ],
    }).compile();

    service = module.get<StudentPortalService>(StudentPortalService);
  });

  // ─── getDashboard ────────────────────────────────────────────────────────────

  describe('getDashboard()', () => {
    it('returns dashboard with default values when all services throw', () => {
      mockAttendanceSvc.getStudentAttendance.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getResults.mockImplementation(() => { throw new Error(); });
      mockAssignmentsSvc.getStudentAssignments.mockImplementation(() => { throw new Error(); });
      mockFeesSvc.getStudentFees.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getCourses.mockReturnValue([]);

      const result = service.getDashboard('USN001');
      expect(result.stats.attendancePct).toBe(85);
      expect(result.stats.cgpa).toBe(7.8);
      expect(result.stats.pendingAssignments).toBe(0);
      expect(result.stats.feeStatus).toBe('PAID');
    });

    it('uses actual attendance from service when available', () => {
      mockAttendanceSvc.getStudentAttendance.mockReturnValue({
        overall: 72,
        subjects: [{ code: 'CS301', name: 'DS', pct: 72, held: 10, attended: 7 }],
      });
      mockCoursesSvc.getResults.mockImplementation(() => { throw new Error(); });
      mockAssignmentsSvc.getStudentAssignments.mockReturnValue([]);
      mockFeesSvc.getStudentFees.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getCourses.mockReturnValue([]);

      const result = service.getDashboard('USN001');
      expect(result.stats.attendancePct).toBe(72);
    });

    it('uses CGPA from courses service', () => {
      mockAttendanceSvc.getStudentAttendance.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getResults.mockReturnValue({ cgpa: 9.0, semesters: [] });
      mockAssignmentsSvc.getStudentAssignments.mockReturnValue([]);
      mockFeesSvc.getStudentFees.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getCourses.mockReturnValue([]);

      const result = service.getDashboard('USN001');
      expect(result.stats.cgpa).toBe(9.0);
    });

    it('sets feeStatus to OVERDUE when any fee is overdue', () => {
      mockAttendanceSvc.getStudentAttendance.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getResults.mockImplementation(() => { throw new Error(); });
      mockAssignmentsSvc.getStudentAssignments.mockReturnValue([]);
      mockFeesSvc.getStudentFees.mockReturnValue({
        totalDue: 100000,
        totalOutstanding: 50000,
        items: [
          { id: 'f1', status: 'PAID', amount: 50000 },
          { id: 'f2', status: 'OVERDUE', amount: 50000 },
        ],
      });
      mockCoursesSvc.getCourses.mockReturnValue([]);

      const result = service.getDashboard('USN001');
      expect(result.stats.feeStatus).toBe('OVERDUE');
    });

    it('sets feeStatus to PARTIAL when some paid and some pending', () => {
      mockAttendanceSvc.getStudentAttendance.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getResults.mockImplementation(() => { throw new Error(); });
      mockAssignmentsSvc.getStudentAssignments.mockReturnValue([]);
      mockFeesSvc.getStudentFees.mockReturnValue({
        totalDue: 100000,
        totalOutstanding: 30000,
        items: [
          { id: 'f1', status: 'PAID', amount: 70000 },
          { id: 'f2', status: 'PENDING', amount: 30000 },
        ],
      });
      mockCoursesSvc.getCourses.mockReturnValue([]);

      const result = service.getDashboard('USN001');
      expect(result.stats.feeStatus).toBe('PARTIAL');
    });

    it('sets feeStatus to PENDING when all fees are pending', () => {
      mockAttendanceSvc.getStudentAttendance.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getResults.mockImplementation(() => { throw new Error(); });
      mockAssignmentsSvc.getStudentAssignments.mockReturnValue([]);
      mockFeesSvc.getStudentFees.mockReturnValue({
        totalDue: 100000,
        totalOutstanding: 100000,
        items: [{ id: 'f1', status: 'PENDING', amount: 100000 }],
      });
      mockCoursesSvc.getCourses.mockReturnValue([]);

      const result = service.getDashboard('USN001');
      expect(result.stats.feeStatus).toBe('PENDING');
    });

    it('counts pending assignments correctly', () => {
      mockAttendanceSvc.getStudentAttendance.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getResults.mockImplementation(() => { throw new Error(); });
      // AssignmentsApiService now returns a flat shape with a derived status
      // ('PENDING' | 'SUBMITTED' | 'GRADED' | 'LATE') as a top-level field.
      mockAssignmentsSvc.getStudentAssignments.mockReturnValue([
        { id: 'a1', status: 'PENDING' },
        { id: 'a2', status: 'SUBMITTED' },
        { id: 'a3', status: 'LATE' },
      ]);
      mockFeesSvc.getStudentFees.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getCourses.mockReturnValue([]);

      const result = service.getDashboard('USN001');
      // PENDING + LATE both count as pending.
      expect(result.stats.pendingAssignments).toBe(2);
    });

    it('includes upcoming events and courses in dashboard', () => {
      mockAttendanceSvc.getStudentAttendance.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getResults.mockImplementation(() => { throw new Error(); });
      mockAssignmentsSvc.getStudentAssignments.mockReturnValue([]);
      mockFeesSvc.getStudentFees.mockImplementation(() => { throw new Error(); });
      mockCoursesSvc.getCourses.mockReturnValue([
        { id: 'c1', code: 'CS301', name: 'DS', instructorName: 'Ravi', enrolled: 60 },
      ]);

      const result = service.getDashboard('USN001');
      expect(result.upcoming).toHaveLength(5);
      expect(result.courses).toHaveLength(1);
    });
  });

  // ─── getSchedule ─────────────────────────────────────────────────────────────

  describe('getSchedule()', () => {
    it('returns empty schedule when no entries exist', () => {
      const result = service.getSchedule('USN001');
      expect(result).toEqual({ schedule: [] });
    });

    it('returns schedule for the given USN', () => {
      const schedule = [{ dayOfWeek: 'Monday', subject: 'DS', room: 'A101', startTime: '09:00', endTime: '10:00' }];
      service.schedules.set('USN001', schedule);
      expect(service.getSchedule('USN001')).toEqual({ schedule });
    });

    it('falls back to default schedule', () => {
      const defaultSchedule = [{ dayOfWeek: 'Tuesday', subject: 'DBMS', room: 'B201', startTime: '11:00', endTime: '12:00' }];
      service.schedules.set('default', defaultSchedule);
      expect(service.getSchedule('USN_NO_SCHEDULE')).toEqual({ schedule: defaultSchedule });
    });
  });

  // ─── getHostel ───────────────────────────────────────────────────────────────

  describe('getHostel()', () => {
    it('returns N/A hostel when no data exists', () => {
      const result = service.getHostel('USN001');
      expect(result.hostel.roomNumber).toBe('N/A');
    });

    it('returns hostel data for specific USN', () => {
      const hostelData = {
        hostel: { roomNumber: 'A101', block: 'A', warden: 'Mr. Kumar', messMenu: [] },
        transport: { route: 'Route 1', pickupPoint: 'Gate 1', timing: '7:30 AM' },
      };
      service.hostelData.set('USN001', hostelData);
      expect(service.getHostel('USN001')).toBe(hostelData);
    });
  });

  // ─── getExamPrep ─────────────────────────────────────────────────────────────

  describe('getExamPrep()', () => {
    it('returns exam prep info with stressLevel, subjectReadiness, resources', () => {
      const result = service.getExamPrep('USN001');
      expect(result.stressLevel).toBeDefined();
      expect(result.subjectReadiness).toHaveLength(3);
      expect(result.resources).toHaveLength(2);
    });
  });

  // ─── getStaff ────────────────────────────────────────────────────────────────

  describe('getStaff()', () => {
    it('returns staff array (empty by default)', () => {
      expect(service.getStaff()).toEqual([]);
    });

    it('returns seeded staff members', () => {
      service.staff.push({ name: 'Dr. Ram', role: 'HOD', department: 'CS', email: 'ram@rvce.edu', phone: '9900000001' });
      expect(service.getStaff()).toHaveLength(1);
    });
  });
});
