import { Test, TestingModule } from '@nestjs/testing';
import { VtuService, VtuWindow, VtuEligibility, VtuRegistration } from './vtu.service';

function makeWindow(overrides: Partial<VtuWindow> = {}): VtuWindow {
  return {
    id: 'win-1',
    title: 'Nov/Dec 2026',
    openDate: '2026-10-01',
    closeDate: '2026-10-15',
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
      service.eligibilities.push({ windowId: 'win-1', usn: 'USN001', eligibleSubjects: ['CS301'], isEligible: true });

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
    it('creates a new registration', () => {
      const result = service.registerStudent('USN001', 'win-1', ['CS301', 'CS302']);
      expect(result.usn).toBe('USN001');
      expect(result.subjectCodes).toEqual(['CS301', 'CS302']);
    });

    it('updates existing registration (idempotent)', () => {
      service.registerStudent('USN001', 'win-1', ['CS301']);
      const result = service.registerStudent('USN001', 'win-1', ['CS301', 'CS302']);
      expect(service.registrations).toHaveLength(1);
      expect(result.subjectCodes).toEqual(['CS301', 'CS302']);
    });
  });

  // ─── getPendingStudents ──────────────────────────────────────────────────────

  describe('getPendingStudents()', () => {
    it('returns eligible students who have not registered', () => {
      service.eligibilities.push(
        { windowId: 'win-1', usn: 'USN001', eligibleSubjects: ['CS301'], isEligible: true },
        { windowId: 'win-1', usn: 'USN002', eligibleSubjects: ['CS301'], isEligible: true },
      );
      service.registrations.push({ windowId: 'win-1', usn: 'USN001', subjectCodes: ['CS301'], registeredAt: '' });

      const result = service.getPendingStudents('win-1');
      expect(result).toHaveLength(1);
      expect(result[0].usn).toBe('USN002');
    });

    it('returns empty array when all eligible students have registered', () => {
      service.eligibilities.push({ windowId: 'win-1', usn: 'USN001', eligibleSubjects: [], isEligible: true });
      service.registrations.push({ windowId: 'win-1', usn: 'USN001', subjectCodes: [], registeredAt: '' });
      expect(service.getPendingStudents('win-1')).toEqual([]);
    });

    it('excludes ineligible students', () => {
      service.eligibilities.push({ windowId: 'win-1', usn: 'USN001', eligibleSubjects: [], isEligible: false });
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
      service.eligibilities.push({ windowId: 'win-1', usn: 'U1', eligibleSubjects: [], isEligible: true });
      service.registrations.push({ windowId: 'win-1', usn: 'U1', subjectCodes: [], registeredAt: '' });

      const result = service.getDeptOverview('win-1');
      expect(result[0].eligible).toBe(1);
      expect(result[0].registered).toBe(1);
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
        { windowId: 'win-1', usn: 'U1', eligibleSubjects: [], isEligible: true },
        { windowId: 'win-1', usn: 'U2', eligibleSubjects: [], isEligible: false },
        { windowId: 'win-2', usn: 'U3', eligibleSubjects: [], isEligible: true },
      );
      const result = service.runEligibility('win-1');
      expect(result.processed).toBe(2);
      expect(result.windowId).toBe('win-1');
    });
  });
});
