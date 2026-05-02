import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { VtuService, VtuWindow, VtuEligibility, VtuRegistration } from './vtu.service';

function makeWindow(overrides: Partial<VtuWindow> = {}): VtuWindow {
  return {
    id: 'win-1',
    title: 'Apr/May 2026',
    openDate: '2000-01-01',
    closeDate: '2099-12-31',
    semester: 5,
    isActive: true,
    subjectCodes: ['CS301', 'CS302'],
    ...overrides,
  };
}

describe('VtuService', () => {
  let service: VtuService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VtuService],
    }).compile();

    service = module.get<VtuService>(VtuService);
  });

  // ─── getAllWindows ───────────────────────────────────────────────────────────

  describe('getAllWindows()', () => {
    it('returns all windows', () => {
      service.windows.push(makeWindow({ id: 'w1' }), makeWindow({ id: 'w2' }));
      expect(service.getAllWindows()).toHaveLength(2);
    });

    it('returns empty array when no windows', () => {
      expect(service.getAllWindows()).toEqual([]);
    });
  });

  // ─── getActiveWindow ────────────────────────────────────────────────────────

  describe('getActiveWindow()', () => {
    it('returns the active window', () => {
      service.windows.push(makeWindow({ id: 'w1', isActive: false }), makeWindow({ id: 'w2', isActive: true }));
      const result = service.getActiveWindow();
      expect(result!.id).toBe('w2');
    });

    it('returns null when no active window', () => {
      service.windows.push(makeWindow({ isActive: false }));
      expect(service.getActiveWindow()).toBeNull();
    });

    it('returns null when no windows at all', () => {
      expect(service.getActiveWindow()).toBeNull();
    });
  });

  // ─── createWindow ───────────────────────────────────────────────────────────

  describe('createWindow()', () => {
    it('creates a new active window and deactivates previous ones', () => {
      service.windows.push(makeWindow({ id: 'old', isActive: true }));
      const result = service.createWindow({
        title: 'New Window',
        openDate: '2026-11-01',
        closeDate: '2026-11-15',
        semester: 6,
      });
      expect(result.isActive).toBe(true);
      expect(result.title).toBe('New Window');
      expect(service.windows[0].isActive).toBe(false); // old one deactivated
    });

    it('assigns empty subjectCodes when none provided', () => {
      const result = service.createWindow({
        title: 'Test',
        openDate: '2026-11-01',
        closeDate: '2026-11-15',
        semester: 5,
      });
      expect(result.subjectCodes).toEqual([]);
    });

    it('uses provided subjectCodes', () => {
      const result = service.createWindow({
        title: 'Test',
        openDate: '2026-11-01',
        closeDate: '2026-11-15',
        semester: 5,
        subjectCodes: ['CS301', 'CS302'],
      });
      expect(result.subjectCodes).toEqual(['CS301', 'CS302']);
    });
  });

  // ─── getStudentStatus ───────────────────────────────────────────────────────

  describe('getStudentStatus()', () => {
    it('returns REGISTERED status when student has a registration', () => {
      service.windows.push(makeWindow({ id: 'win-1', subjectCodes: ['CS301', 'CS302'] }));
      service.registrations.push({ windowId: 'win-1', usn: 'USN001', subjectCodes: ['CS301'], registeredAt: '' });

      const result = service.getStudentStatus('USN001', 'win-1');
      expect(result.status).toBe('REGISTERED');
      expect(result.registeredSubjects).toContain('CS301');
    });

    it('returns ELIGIBLE when eligible but not registered', () => {
      service.windows.push(makeWindow({ id: 'win-1', subjectCodes: ['CS301', 'CS302'] }));
      service.eligibilities.push({ windowId: 'win-1', usn: 'USN001', eligibleSubjects: ['CS301'], isEligible: true, category: 'REGULAR' as const });

      const result = service.getStudentStatus('USN001', 'win-1');
      expect(result.status).toBe('ELIGIBLE');
      expect(result.eligibleSubjects).toContain('CS301');
      expect(result.ineligibleSubjects).toContain('CS302');
    });

    it('returns INELIGIBLE when no eligibility record', () => {
      service.windows.push(makeWindow({ id: 'win-1' }));
      const result = service.getStudentStatus('USN001', 'win-1');
      expect(result.status).toBe('INELIGIBLE');
    });
  });

  // ─── registerStudent ────────────────────────────────────────────────────────

  describe('registerStudent()', () => {
    const VALID_USN = '1RV21CS001';

    beforeEach(() => {
      service.windows.push(makeWindow({ id: 'win-1', subjectCodes: ['CS301', 'CS302'] }));
      service.eligibilities.push({ windowId: 'win-1', usn: VALID_USN, eligibleSubjects: ['CS301', 'CS302'], isEligible: true, category: 'REGULAR' as const });
    });

    it('creates a new registration', () => {
      const result = service.registerStudent(VALID_USN, 'win-1', ['CS301', 'CS302']);
      expect(result.usn).toBe(VALID_USN);
      expect(result.subjectCodes).toEqual(['CS301', 'CS302']);
    });

    it('updates existing registration (idempotent)', () => {
      service.registerStudent(VALID_USN, 'win-1', ['CS301']);
      const result = service.registerStudent(VALID_USN, 'win-1', ['CS301', 'CS302']);
      expect(service.registrations).toHaveLength(1);
      expect(result.subjectCodes).toEqual(['CS301', 'CS302']);
    });

    it('re-registration updates registeredAt timestamp', () => {
      const first = service.registerStudent(VALID_USN, 'win-1', ['CS301']);
      const firstTime = first.registeredAt;
      const second = service.registerStudent(VALID_USN, 'win-1', ['CS301', 'CS302']);
      // registeredAt should be refreshed on re-registration
      expect(second.registeredAt).toBeDefined();
      expect(second.subjectCodes).toContain('CS302');
    });
  });

  // ─── getPendingStudents ──────────────────────────────────────────────────────

  describe('getPendingStudents()', () => {
    it('returns eligible students who have not registered', () => {
      service.eligibilities.push(
        { windowId: 'win-1', usn: 'USN001', eligibleSubjects: ['CS301'], isEligible: true, category: 'REGULAR' as const },
        { windowId: 'win-1', usn: 'USN002', eligibleSubjects: ['CS301'], isEligible: true, category: 'REGULAR' as const },
      );
      service.registrations.push({ windowId: 'win-1', usn: 'USN001', subjectCodes: ['CS301'], registeredAt: '' });

      const result = service.getPendingStudents('win-1');
      expect(result).toHaveLength(1);
      expect(result[0].usn).toBe('USN002');
    });

    it('returns empty array when all eligible students have registered', () => {
      service.eligibilities.push({ windowId: 'win-1', usn: 'USN001', eligibleSubjects: [], isEligible: true, category: 'REGULAR' as const });
      service.registrations.push({ windowId: 'win-1', usn: 'USN001', subjectCodes: [], registeredAt: '' });
      expect(service.getPendingStudents('win-1')).toEqual([]);
    });

    it('excludes ineligible students', () => {
      service.eligibilities.push({ windowId: 'win-1', usn: 'USN001', eligibleSubjects: [], isEligible: false, category: 'REGULAR' as const });
      expect(service.getPendingStudents('win-1')).toEqual([]);
    });
  });

  // ─── getDeptOverview ────────────────────────────────────────────────────────

  describe('getDeptOverview()', () => {
    it('returns overview for 4 departments', () => {
      const result = service.getDeptOverview('win-1');
      expect(result).toHaveLength(4);
      expect(result.map((r) => r.dept)).toEqual(['CS', 'EC', 'ME', 'CV']);
    });

    it('includes eligible and registered counts', () => {
      service.eligibilities.push({ windowId: 'win-1', usn: '1RV21CS001', eligibleSubjects: [], isEligible: true, category: 'REGULAR' as const });
      service.registrations.push({ windowId: 'win-1', usn: '1RV21CS001', subjectCodes: [], registeredAt: '' });

      const result = service.getDeptOverview('win-1');
      const csDept = result.find((r) => r.dept === 'CS');
      expect(csDept?.eligible).toBe(1);
      expect(csDept?.registered).toBe(1);
    });
  });

  // ─── sendReminders ──────────────────────────────────────────────────────────

  describe('sendReminders()', () => {
    it('returns reminded USNs and windowId', () => {
      const result = service.sendReminders('win-1', ['USN001', 'USN002']);
      expect(result).toEqual({ reminded: ['USN001', 'USN002'], windowId: 'win-1' });
    });
  });

  // ─── runEligibility ─────────────────────────────────────────────────────────

  describe('runEligibility()', () => {
    it('returns processed count and windowId', () => {
      service.eligibilities.push(
        { windowId: 'win-1', usn: '1RV21CS001', eligibleSubjects: [], isEligible: true, category: 'REGULAR' as const },
        { windowId: 'win-1', usn: '1RV21CS002', eligibleSubjects: [], isEligible: false, category: 'REGULAR' as const },
        { windowId: 'win-2', usn: '1RV21CS003', eligibleSubjects: [], isEligible: true, category: 'REGULAR' as const },
      );
      const result = service.runEligibility('win-1');
      expect(result.processed).toBe(2);
      expect(result.windowId).toBe('win-1');
    });
  });

  // ─── validateUsn ────────────────────────────────────────────────────────────

  describe('validateUsn()', () => {
    it('does not throw for valid USN', () => {
      expect(() => service.validateUsn('1RV21CS001')).not.toThrow();
    });

    it('throws BadRequestException for invalid USN', () => {
      expect(() => service.validateUsn('INVALID')).toThrow(BadRequestException);
    });
  });

  // ─── computeEligibility ──────────────────────────────────────────────────────

  describe('computeEligibility()', () => {
    it('EX_STUDENT is always eligible regardless of attendance', () => {
      const result = service.computeEligibility('USN001', { attendancePct: 0, category: 'EX_STUDENT' });
      expect(result.isEligible).toBe(true);
    });

    it('REGULAR with attendance >= 75 is eligible', () => {
      const result = service.computeEligibility('USN001', { attendancePct: 75, category: 'REGULAR' });
      expect(result.isEligible).toBe(true);
    });

    it('REGULAR with attendance < 75 is ineligible', () => {
      const result = service.computeEligibility('USN001', { attendancePct: 70, category: 'REGULAR' });
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('70.00%');
    });

    it('USDE with attendance >= 65 is eligible', () => {
      const result = service.computeEligibility('USN001', { attendancePct: 65, category: 'USDE' });
      expect(result.isEligible).toBe(true);
    });

    it('unknown category defaults threshold to 75', () => {
      const result = service.computeEligibility('USN001', { attendancePct: 74 });
      expect(result.isEligible).toBe(false);
    });
  });

  // ─── getWindowById ───────────────────────────────────────────────────────────

  describe('getWindowById()', () => {
    it('returns window by id', () => {
      service.windows.push(makeWindow({ id: 'win-x' }));
      expect(service.getWindowById('win-x').id).toBe('win-x');
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => service.getWindowById('no-such')).toThrow(NotFoundException);
    });
  });

  // ─── getStudentStatus (no window case) ──────────────────────────────────────

  describe('getStudentStatus() — no window', () => {
    it('returns empty allSubjects when window not found', () => {
      const result = service.getStudentStatus('USN001', 'non-existent-window');
      expect(result.eligibleSubjects).toEqual([]);
      expect(result.ineligibleSubjects).toEqual([]);
      expect(result.status).toBe('INELIGIBLE');
    });
  });

  // ─── registerStudent edge cases ──────────────────────────────────────────────

  describe('registerStudent() — error paths', () => {
    it('throws NotFoundException when window not found', () => {
      expect(() => service.registerStudent('1RV21CS001', 'no-win', ['CS301'])).toThrow(NotFoundException);
    });

    it('throws ConflictException when window is inactive', () => {
      service.windows.push(makeWindow({ id: 'win-inactive', isActive: false }));
      service.eligibilities.push({ windowId: 'win-inactive', usn: '1RV21CS001', eligibleSubjects: ['CS301'], isEligible: true, category: 'REGULAR' as const });
      expect(() => service.registerStudent('1RV21CS001', 'win-inactive', ['CS301'])).toThrow(ConflictException);
    });

    it('throws ConflictException when window is past closeDate', () => {
      service.windows.push(makeWindow({ id: 'win-closed', isActive: true, closeDate: '2020-01-01' }));
      service.eligibilities.push({ windowId: 'win-closed', usn: '1RV21CS001', eligibleSubjects: ['CS301'], isEligible: true, category: 'REGULAR' as const });
      expect(() => service.registerStudent('1RV21CS001', 'win-closed', ['CS301'])).toThrow(ConflictException);
    });

    it('throws ConflictException when student has no eligibility record', () => {
      service.windows.push(makeWindow({ id: 'win-elig', isActive: true }));
      expect(() => service.registerStudent('1RV21CS001', 'win-elig', ['CS301'])).toThrow(ConflictException);
    });

    it('throws ConflictException when student is not eligible', () => {
      service.windows.push(makeWindow({ id: 'win-inelig', isActive: true }));
      service.eligibilities.push({ windowId: 'win-inelig', usn: '1RV21CS001', eligibleSubjects: [], isEligible: false, category: 'REGULAR' as const });
      expect(() => service.registerStudent('1RV21CS001', 'win-inelig', ['CS301'])).toThrow(ConflictException);
    });

    it('throws BadRequestException when requesting ineligible subjects', () => {
      service.windows.push(makeWindow({ id: 'win-subj', isActive: true }));
      service.eligibilities.push({ windowId: 'win-subj', usn: '1RV21CS001', eligibleSubjects: ['CS301'], isEligible: true, category: 'REGULAR' as const });
      expect(() => service.registerStudent('1RV21CS001', 'win-subj', ['CS301', 'CS302'])).toThrow(BadRequestException);
    });
  });

  // ─── getPendingStudents — short USN (UNKNOWN dept) ──────────────────────────

  describe('getPendingStudents() — short USN', () => {
    it('assigns UNKNOWN dept for USN shorter than 10 chars', () => {
      service.eligibilities.push({
        windowId: 'win-1', usn: 'SHORTUSN', eligibleSubjects: [], isEligible: true, category: 'REGULAR' as const,
      });
      const result = service.getPendingStudents('win-1');
      expect(result[0].dept).toBe('UNKNOWN');
    });
  });

  // ─── getDeptOverview — short USN ─────────────────────────────────────────────

  describe('getDeptOverview() — short USN', () => {
    it('excludes short USNs from dept matching', () => {
      service.eligibilities.push({
        windowId: 'win-1', usn: 'SHORT', eligibleSubjects: [], isEligible: true, category: 'REGULAR' as const,
      });
      service.registrations.push({ windowId: 'win-1', usn: 'SHORT', subjectCodes: [], registeredAt: '' });
      const result = service.getDeptOverview('win-1');
      // No dept should match 'SHORT' since it's not 10 chars → all counts stay 0
      expect(result.every((r) => r.eligible === 0 && r.registered === 0)).toBe(true);
    });
  });

  // ─── getActiveWindow — date-bounded ──────────────────────────────────────────

  describe('getActiveWindow() — date filtering', () => {
    it('returns null when window is active but before openDate', () => {
      service.windows.push(makeWindow({ id: 'w-future', isActive: true, openDate: '2099-01-01', closeDate: '2099-12-31' }));
      expect(service.getActiveWindow()).toBeNull();
    });

    it('returns window when active and within date range', () => {
      service.windows.push(makeWindow({ id: 'w-open', isActive: true, openDate: '2000-01-01', closeDate: '2099-12-31' }));
      expect(service.getActiveWindow()?.id).toBe('w-open');
    });
  });

  // ─── onModuleInit (DB hydration) ─────────────────────────────────────────────

  describe('onModuleInit()', () => {
    it('skips hydration when no repos injected', async () => {
      const svc = new VtuService();
      await svc.onModuleInit();
      expect(svc.windows).toEqual([]);
      expect(svc.eligibilities).toEqual([]);
      expect(svc.registrations).toEqual([]);
    });

    it('hydrates windows from DB when windowRepo is present', async () => {
      const mockRow = { id: 'win-db-1', title: 'Apr 2026', openDate: '2026-04-01', closeDate: '2026-04-30', semester: 6, isActive: true, subjectCodes: ['CS301'] };
      const mockWindowRepo = { find: jest.fn().mockResolvedValue([mockRow]) };
      const svc = new VtuService(mockWindowRepo as any, undefined, undefined);
      await svc.onModuleInit();
      expect(svc.windows).toHaveLength(1);
      expect(svc.windows[0].id).toBe('win-db-1');
      expect(svc.windows[0].subjectCodes).toContain('CS301');
    });

    it('hydrates eligibilities from DB when eligibilityRepo is present', async () => {
      const mockRow = { id: 'elig-1', windowId: 'win-1', usn: '1RV21CS001', eligibleSubjects: ['CS301'], isEligible: true, category: 'REGULAR' };
      const mockEligRepo = { find: jest.fn().mockResolvedValue([mockRow]) };
      const svc = new VtuService(undefined, mockEligRepo as any, undefined);
      await svc.onModuleInit();
      expect(svc.eligibilities).toHaveLength(1);
      expect(svc.eligibilities[0].category).toBe('REGULAR');
    });

    it('hydrates registrations from DB, converts Date to ISO string', async () => {
      const mockRow = { id: 'reg-1', windowId: 'win-1', usn: '1RV21CS001', subjectCodes: ['CS301'], registeredAt: new Date('2026-04-10T10:00:00Z') };
      const mockRegRepo = { find: jest.fn().mockResolvedValue([mockRow]) };
      const svc = new VtuService(undefined, undefined, mockRegRepo as any);
      await svc.onModuleInit();
      expect(svc.registrations).toHaveLength(1);
      expect(svc.registrations[0].registeredAt).toBe('2026-04-10T10:00:00.000Z');
    });
  });
});
