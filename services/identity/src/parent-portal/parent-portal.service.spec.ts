import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ParentPortalService } from './parent-portal.service';
import { AttendanceApiService } from '../attendance-api/attendance-api.service';
import { FeesApiService } from '../fees-api/fees-api.service';
import { CoursesService } from '../courses/courses.service';

const mockAttendanceSvc = { getStudentAttendance: jest.fn() };
const mockFeesSvc = {
  getStudentFees: jest.fn(),
  initiatePaymentGateway: jest.fn(),
  verifyPayment: jest.fn(),
  feeItems: [],
};
const mockCoursesSvc = { getResults: jest.fn(), getCourses: jest.fn() };

describe('ParentPortalService', () => {
  let service: ParentPortalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentPortalService,
        { provide: AttendanceApiService, useValue: mockAttendanceSvc },
        { provide: FeesApiService, useValue: mockFeesSvc },
        { provide: CoursesService, useValue: mockCoursesSvc },
      ],
    }).compile();

    service = module.get<ParentPortalService>(ParentPortalService);
  });

  // ─── getChildren ────────────────────────────────────────────────────────────

  describe('getChildren()', () => {
    it('returns a default child when parentChildMap has no entry', () => {
      const result = service.getChildren('unknown-parent');
      expect(result).toHaveLength(1);
      expect(result[0].usn).toBe('1RV21CS001');
    });

    it('returns mapped profile when childProfiles has an entry', () => {
      service.parentChildMap.set('parent-1', ['USN001']);
      service.childProfiles.set('USN001', {
        usn: 'USN001',
        name: 'Alice',
        semester: 5,
        dept: 'CS',
        cgpa: 8.5,
        attendance: 90,
      });
      const result = service.getChildren('parent-1');
      expect(result[0].name).toBe('Alice');
      expect(result[0].cgpa).toBe(8.5);
    });

    it('returns a stub ChildInfo when childProfiles has no entry for usn', () => {
      service.parentChildMap.set('parent-2', ['USN_STUB']);
      const result = service.getChildren('parent-2');
      expect(result[0].usn).toBe('USN_STUB');
      expect(result[0].cgpa).toBe(7.5); // default
    });
  });

  // ─── getDashboard ────────────────────────────────────────────────────────────

  describe('getDashboard()', () => {
    it('returns dashboard with pendingFees summed from fees service', () => {
      service.parentChildMap.set('parent-1', ['USN001']);
      mockFeesSvc.getStudentFees.mockReturnValue({
        totalDue: 100000,
        totalOutstanding: 30000,
        items: [],
      });

      const result = service.getDashboard('parent-1');
      expect(result.pendingFees).toBe(30000);
      expect(result.recentNotifications).toHaveLength(1);
    });

    it('returns zero pendingFees when fees service throws', () => {
      service.parentChildMap.set('parent-3', ['USN_NO_FEES']);
      mockFeesSvc.getStudentFees.mockImplementation(() => {
        throw new NotFoundException('No fees');
      });

      const result = service.getDashboard('parent-3');
      expect(result.pendingFees).toBe(0);
    });
  });

  // ─── getChildAttendance ──────────────────────────────────────────────────────

  describe('getChildAttendance()', () => {
    it('returns attendance from attendance service', () => {
      mockAttendanceSvc.getStudentAttendance.mockReturnValue({ overall: 85, subjects: [] });
      const result = service.getChildAttendance('USN001');
      expect(result.overall).toBe(85);
    });

    it('returns fallback when attendance service throws', () => {
      mockAttendanceSvc.getStudentAttendance.mockImplementation(() => {
        throw new Error('no records');
      });
      const result = service.getChildAttendance('USN_NONE');
      expect(result).toEqual({ overall: 80, subjects: [] });
    });
  });

  // ─── getChildResults ─────────────────────────────────────────────────────────

  describe('getChildResults()', () => {
    it('returns results from courses service', () => {
      const mockResult = { usn: 'USN001', cgpa: 8.5, semesters: [] };
      mockCoursesSvc.getResults.mockReturnValue(mockResult);
      expect(service.getChildResults('USN001')).toBe(mockResult);
    });

    it('returns fallback when courses service throws', () => {
      mockCoursesSvc.getResults.mockImplementation(() => {
        throw new Error('not found');
      });
      const result = service.getChildResults('USN_NONE');
      expect(result).toEqual({ usn: 'USN_NONE', cgpa: 7.5, semesters: [] });
    });
  });

  // ─── getChildFees ────────────────────────────────────────────────────────────

  describe('getChildFees()', () => {
    it('returns fees from fees service', () => {
      const mockFees = { totalDue: 50000, totalOutstanding: 20000, items: [] };
      mockFeesSvc.getStudentFees.mockReturnValue(mockFees);
      expect(service.getChildFees('USN001')).toBe(mockFees);
    });

    it('returns fallback when fees service throws', () => {
      mockFeesSvc.getStudentFees.mockImplementation(() => {
        throw new Error('no fees');
      });
      const result = service.getChildFees('USN_NONE');
      expect(result).toEqual({ totalDue: 0, totalPaid: 0, totalOutstanding: 0, status: 'PENDING', items: [] });
    });
  });

  // ─── getChild — profile exists vs default ───────────────────────────────────

  describe('getChild() — profile exists vs default', () => {
    it('returns real profile data when childProfiles has an entry for the USN', () => {
      (service as unknown as { childProfiles: Map<string, unknown> }).childProfiles.set('1RV21CS001', {
        name: 'Priya Kumar',
        dept: 'ECE',
        semester: 6,
        cgpa: 8.5,
        attendance: 92,
      });
      const result = service.getChild('1RV21CS001');
      expect(result.name).toBe('Priya Kumar');
      expect(result.dept).toBe('ECE');
      expect(result.cgpa).toBe(8.5);
      expect(result.attendancePct).toBe(92);
    });

    it('returns default values when no profile exists for USN', () => {
      const result = service.getChild('UNKNOWN_USN');
      expect(result.name).toBe('Student UNKNOWN_USN');
      expect(result.dept).toBe('Computer Science');
      expect(result.semester).toBe(5);
      expect(result.cgpa).toBe(7.5);
    });
  });

  // ─── isParentOf ─────────────────────────────────────────────────────────────

  describe('isParentOf()', () => {
    it('returns true for the dev seed USN when no mapping exists and NODE_ENV != production', () => {
      delete process.env['NODE_ENV'];
      const result = service.isParentOf('unknown-parent', '1RV21CS001');
      expect(result).toBe(true);
    });

    it('returns false for non-seed USN when no mapping exists', () => {
      delete process.env['NODE_ENV'];
      const result = service.isParentOf('unknown-parent', '1RV21CS099');
      expect(result).toBe(false);
    });

    it('returns false for any USN when no mapping exists and NODE_ENV = production', () => {
      process.env['NODE_ENV'] = 'production';
      const result = service.isParentOf('unknown-parent', '1RV21CS001');
      expect(result).toBe(false);
      delete process.env['NODE_ENV'];
    });

    it('returns true when explicit mapping contains the USN', () => {
      service.parentChildMap.set('parent-explicit', ['USN100', 'USN101']);
      expect(service.isParentOf('parent-explicit', 'USN100')).toBe(true);
    });

    it('returns false when explicit mapping does NOT contain the USN', () => {
      service.parentChildMap.set('parent-explicit', ['USN100']);
      expect(service.isParentOf('parent-explicit', 'USN999')).toBe(false);
    });
  });

  // ─── payFees ────────────────────────────────────────────────────────────────

  describe('payFees()', () => {
    it('throws NotFoundException when all provided feeIds are already PAID', async () => {
      mockFeesSvc.getStudentFees.mockReturnValue({
        totalDue: 50000,
        totalOutstanding: 0,
        items: [
          { id: 'f-1', amount: 25000, status: 'PAID' },
          { id: 'f-2', amount: 25000, status: 'PAID' },
        ],
      });
      await expect(service.payFees('USN001', ['f-1', 'f-2'])).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when feeIds do not match any item', async () => {
      mockFeesSvc.getStudentFees.mockReturnValue({
        totalDue: 50000,
        totalOutstanding: 50000,
        items: [{ id: 'f-99', amount: 50000, status: 'PENDING' }],
      });
      await expect(service.payFees('USN001', ['f-WRONG'])).rejects.toThrow(NotFoundException);
    });

    it('excludes PAID items and computes amount server-side from remaining unpaid fees', async () => {
      mockFeesSvc.getStudentFees.mockReturnValue({
        totalDue: 75000,
        totalOutstanding: 50000,
        items: [
          { id: 'f-1', amount: 25000, status: 'PAID' },
          { id: 'f-2', amount: 50000, status: 'PENDING' },
        ],
      });
      mockFeesSvc.initiatePaymentGateway.mockResolvedValue({ orderId: 'order_abc', amount: 50000 });
      await service.payFees('USN001', ['f-1', 'f-2']);
      expect(mockFeesSvc.initiatePaymentGateway).toHaveBeenCalledWith('USN001', 50000, ['f-2']);
    });

    it('computes correct total when multiple unpaid fees selected', async () => {
      mockFeesSvc.getStudentFees.mockReturnValue({
        totalDue: 90000,
        totalOutstanding: 90000,
        items: [
          { id: 'f-tuition', amount: 60000, status: 'PENDING' },
          { id: 'f-lab', amount: 30000, status: 'PENDING' },
        ],
      });
      mockFeesSvc.initiatePaymentGateway.mockResolvedValue({ orderId: 'order_xyz', amount: 90000 });
      await service.payFees('USN001', ['f-tuition', 'f-lab']);
      expect(mockFeesSvc.initiatePaymentGateway).toHaveBeenCalledWith('USN001', 90000, ['f-tuition', 'f-lab']);
    });
  });

  // ─── verifyFeePayment ───────────────────────────────────────────────────────

  describe('verifyFeePayment()', () => {
    it('delegates to feesSvc and returns the result on success', async () => {
      mockFeesSvc.verifyPayment.mockResolvedValue({ success: true, receiptId: 'rcpt_001' });
      const result = await service.verifyFeePayment('order_123', 'pay_abc', 'valid_sig');
      expect(result).toEqual({ success: true, receiptId: 'rcpt_001' });
      expect(mockFeesSvc.verifyPayment).toHaveBeenCalledWith('order_123', 'pay_abc', 'valid_sig');
    });

    it('propagates rejection when signature verification fails', async () => {
      mockFeesSvc.verifyPayment.mockRejectedValue(new Error('invalid_signature'));
      await expect(service.verifyFeePayment('order_123', 'pay_abc', 'TAMPERED')).rejects.toThrow('invalid_signature');
    });
  });

  // ─── checkScholarship ───────────────────────────────────────────────────────

  describe('checkScholarship()', () => {
    it('returns eligible true with all three scheme entries', () => {
      const result = service.checkScholarship('USN001');
      expect(result.eligible).toBe(true);
      expect(result.schemes).toHaveLength(3);
      expect(result.schemes.map((s) => s.name)).toEqual([
        'SC/ST Scholarship',
        'Merit Scholarship',
        'National Scholarship Portal',
      ]);
    });

    it('returns correct scholarship amounts for Karnataka SC/ST and NSP criteria', () => {
      const result = service.checkScholarship('1RV21CS001');
      const scst = result.schemes.find((s) => s.name === 'SC/ST Scholarship');
      const merit = result.schemes.find((s) => s.name === 'Merit Scholarship');
      const nsp = result.schemes.find((s) => s.name === 'National Scholarship Portal');
      expect(scst?.amount).toBe(25000);
      expect(merit?.amount).toBe(15000);
      expect(nsp?.amount).toBe(20000);
    });
  });
});
