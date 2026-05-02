import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobsService, Job, PlacementPrediction, PlacementDrive } from './jobs.service';

const makeDrive = (overrides: Partial<PlacementDrive> = {}): PlacementDrive => ({
  id: 'drive-1',
  company: 'Microsoft',
  scheduledDate: '2026-05-10',
  venue: 'Auditorium',
  rounds: ['Online Test', 'Technical Interview'],
  eligibleDepts: ['CSE', 'ISE'],
  minCgpa: 7.0,
  status: 'SCHEDULED',
  offersExtended: 0,
  ...overrides,
});

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  company: 'Infosys',
  role: 'SDE',
  package: '10 LPA',
  deadline: '2026-06-01',
  eligibility: 'CGPA >= 7.0',
  applyUrl: 'https://infosys.com/apply',
  ...overrides,
});

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobsService],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  // ─── getJobs ────────────────────────────────────────────────────────────────

  describe('getJobs()', () => {
    it('returns all jobs', () => {
      service.jobs.push(makeJob({ id: 'j1' }), makeJob({ id: 'j2' }));
      expect(service.getJobs()).toHaveLength(2);
    });

    it('returns empty array when no jobs', () => {
      expect(service.getJobs()).toEqual([]);
    });
  });

  // ─── apply ──────────────────────────────────────────────────────────────────

  describe('apply()', () => {
    it('creates an application and returns success message', () => {
      service.jobs.push(makeJob({ id: 'job-1' }));
      const result = service.apply('job-1', 'USN001');
      expect(result).toEqual({ message: 'Application submitted' });
      expect(service.applications).toHaveLength(1);
    });

    it('does not create duplicate applications', () => {
      service.jobs.push(makeJob({ id: 'job-1' }));
      service.apply('job-1', 'USN001');
      service.apply('job-1', 'USN001');
      expect(service.applications).toHaveLength(1);
    });

    it('returns success even on duplicate (idempotent)', () => {
      service.jobs.push(makeJob({ id: 'job-1' }));
      service.apply('job-1', 'USN001');
      const result = service.apply('job-1', 'USN001');
      expect(result).toEqual({ message: 'Application submitted' });
    });

    it('throws NotFoundException for unknown jobId', () => {
      expect(() => service.apply('no-such-job', 'USN001')).toThrow(NotFoundException);
    });
  });

  // ─── getMyApplications ──────────────────────────────────────────────────────

  describe('getMyApplications()', () => {
    it('returns applications for a student with job details', () => {
      service.jobs.push(makeJob({ id: 'job-1', company: 'TCS', role: 'DevOps' }));
      service.apply('job-1', 'USN001');
      const result = service.getMyApplications('USN001');
      expect(result).toHaveLength(1);
      expect(result[0].companyName).toBe('TCS');
      expect(result[0].role).toBe('DevOps');
      expect(result[0].status).toBe('APPLIED');
    });

    it('returns empty array for student with no applications', () => {
      expect(service.getMyApplications('USN999')).toEqual([]);
    });

    it('uses Unknown when job not found (orphaned application)', () => {
      service.applications.push({ jobId: 'orphan-job', usn: 'USN001', appliedAt: '2026-04-01' });
      const result = service.getMyApplications('USN001');
      expect(result[0].companyName).toBe('Unknown');
      expect(result[0].role).toBe('Unknown');
    });
  });

  // ─── getPredictions ─────────────────────────────────────────────────────────

  describe('getPredictions()', () => {
    beforeEach(() => {
      service.predictions.push(
        { usn: 'U1', name: 'Alice', likelihood: 'HIGH', skillGaps: [], dept: 'CS' },
        { usn: 'U2', name: 'Bob', likelihood: 'LOW', skillGaps: ['Java'], dept: 'EC' },
        { usn: 'U3', name: 'Carol', likelihood: 'HIGH', skillGaps: [], dept: 'CS' },
      );
    });

    it('returns all predictions when no filters provided', () => {
      expect(service.getPredictions()).toHaveLength(3);
    });

    it('filters by dept', () => {
      const result = service.getPredictions('CS');
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.dept === 'CS')).toBe(true);
    });

    it('filters by likelihood', () => {
      const result = service.getPredictions(undefined, 'HIGH');
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.likelihood === 'HIGH')).toBe(true);
    });

    it('filters by both dept and likelihood', () => {
      const result = service.getPredictions('CS', 'HIGH');
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no matches', () => {
      expect(service.getPredictions('ME', 'HIGH')).toEqual([]);
    });
  });

  // ─── Placement Intelligence SKU ─────────────────────────────────────────

  describe('getDrives()', () => {
    it('returns all drives when no status filter', () => {
      service.drives.push(makeDrive({ id: 'd1', status: 'SCHEDULED' }), makeDrive({ id: 'd2', status: 'COMPLETED' }));
      expect(service.getDrives()).toHaveLength(2);
    });

    it('filters drives by status', () => {
      service.drives.push(makeDrive({ id: 'd1', status: 'SCHEDULED' }), makeDrive({ id: 'd2', status: 'COMPLETED' }));
      expect(service.getDrives('SCHEDULED')).toHaveLength(1);
      expect(service.getDrives('completed')).toHaveLength(1); // case-insensitive
    });
  });

  describe('getDrive()', () => {
    it('returns drive by id', () => {
      service.drives.push(makeDrive({ id: 'drive-x' }));
      expect(service.getDrive('drive-x').id).toBe('drive-x');
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => service.getDrive('no-such')).toThrow(NotFoundException);
    });
  });

  describe('createDrive()', () => {
    it('creates drive with generated id and offersExtended=0', () => {
      const payload = makeDrive();
      const { id: _id, offersExtended: _o, ...rest } = payload;
      const result = service.createDrive(rest);
      expect(result.id).toMatch(/^drive-/);
      expect(result.offersExtended).toBe(0);
      expect(service.drives).toHaveLength(1);
    });
  });

  describe('completeDrive()', () => {
    it('marks drive COMPLETED and sets offersExtended', () => {
      service.drives.push(makeDrive({ id: 'drive-1', status: 'SCHEDULED' }));
      const result = service.completeDrive('drive-1', 25);
      expect(result.status).toBe('COMPLETED');
      expect(result.offersExtended).toBe(25);
    });

    it('throws NotFoundException for unknown drive', () => {
      expect(() => service.completeDrive('no-drive', 10)).toThrow(NotFoundException);
    });
  });

  describe('getAlumniOutcomes()', () => {
    beforeEach(() => {
      service.alumni.push(
        { usn: 'USN1', name: 'Alice', graduationYear: 2024, company: 'Google', role: 'SWE', packageLpa: 40, dept: 'CSE', location: 'Bengaluru' },
        { usn: 'USN2', name: 'Bob',   graduationYear: 2023, company: 'TCS',    role: 'Analyst', packageLpa: 4, dept: 'ME', location: 'Pune' },
      );
    });

    it('returns all alumni when no filters', () => {
      expect(service.getAlumniOutcomes()).toHaveLength(2);
    });

    it('filters by dept', () => {
      expect(service.getAlumniOutcomes('CSE')).toHaveLength(1);
      expect(service.getAlumniOutcomes('CSE')[0].name).toBe('Alice');
    });

    it('filters by graduation year', () => {
      expect(service.getAlumniOutcomes(undefined, 2023)).toHaveLength(1);
      expect(service.getAlumniOutcomes(undefined, 2023)[0].name).toBe('Bob');
    });

    it('filters by both dept and year', () => {
      expect(service.getAlumniOutcomes('CSE', 2024)).toHaveLength(1);
      expect(service.getAlumniOutcomes('CSE', 2023)).toHaveLength(0);
    });
  });

  describe('addAlumniOutcome()', () => {
    it('adds to alumni array and returns it', () => {
      const outcome = { usn: 'USN3', name: 'Carol', graduationYear: 2025, company: 'Amazon', role: 'SDE I', packageLpa: 28, dept: 'CSE', location: 'Bengaluru' };
      const result = service.addAlumniOutcome(outcome);
      expect(result.usn).toBe('USN3');
      expect(service.alumni).toHaveLength(1);
    });
  });

  describe('getPlacementStats()', () => {
    it('returns stats for all depts when no filter', () => {
      const result = service.getPlacementStats();
      expect(result.length).toBeGreaterThan(0);
    });

    it('filters by dept', () => {
      const result = service.getPlacementStats('CSE');
      expect(result.every((s) => s.dept === 'CSE')).toBe(true);
    });

    it('filters by academic year', () => {
      const result = service.getPlacementStats(undefined, '2023-24');
      expect(result.every((s) => s.academicYear === '2023-24')).toBe(true);
    });

    it('placementPct is between 0 and 100', () => {
      service.getPlacementStats().forEach((s) => {
        expect(s.placementPct).toBeGreaterThanOrEqual(0);
        expect(s.placementPct).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('getSkillGapReport()', () => {
    it('returns all reports when no dept filter', () => {
      const result = service.getSkillGapReport();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].missingSkills).toBeInstanceOf(Array);
      expect(result[0].recommendedCourses).toBeInstanceOf(Array);
    });

    it('filters by dept', () => {
      const cse = service.getSkillGapReport('CSE');
      expect(cse.every((r) => r.dept === 'CSE')).toBe(true);
    });

    it('placementScore is between 0 and 100', () => {
      service.getSkillGapReport().forEach((r) => {
        expect(r.placementScore).toBeGreaterThanOrEqual(0);
        expect(r.placementScore).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('getPlacementSummary()', () => {
    it('returns summary with all required fields', () => {
      const result = service.getPlacementSummary();
      expect(result.currentYear).toBeDefined();
      expect(result.totalEligible).toBeGreaterThan(0);
      expect(result.placed).toBeGreaterThan(0);
      expect(result.placementPct).toBeGreaterThanOrEqual(0);
      expect(result.placementPct).toBeLessThanOrEqual(100);
      expect(result.avgPackageLpa).toBeGreaterThan(0);
      expect(result.highestPackageLpa).toBeGreaterThan(0);
      expect(result.topRecruiter).toBeTruthy();
    });

    it('drivesScheduled reflects drives array length', () => {
      service.drives.push(makeDrive({ id: 'd1' }), makeDrive({ id: 'd2' }));
      expect(service.getPlacementSummary().drivesScheduled).toBe(2);
    });
  });

  // ─── onModuleInit (DB hydration) ─────────────────────────────────────────────

  describe('onModuleInit()', () => {
    it('skips hydration when no repos injected', async () => {
      const svc = new JobsService();
      await svc.onModuleInit();
      expect(svc.drives).toEqual([]);
      expect(svc.alumni).toEqual([]);
    });

    it('drives remain empty on init (no DB repo — drives are in-memory only)', async () => {
      const svc = new JobsService();
      await svc.onModuleInit();
      expect(svc.drives).toEqual([]);
    });

    it('hydrates alumni from DB, maps decimal packageLpa to number', async () => {
      const mockRow = { usn: '1RV19CS001', name: 'Priya M', graduationYear: 2023, company: 'Amazon', role: 'SDE', packageLpa: '18.5', dept: 'CSE', location: 'Bengaluru' };
      const mockAlumniRepo = { find: jest.fn().mockResolvedValue([mockRow]) };
      const svc = new JobsService(mockAlumniRepo as any);
      await svc.onModuleInit();
      expect(svc.alumni).toHaveLength(1);
      expect(svc.alumni[0].packageLpa).toBe(18.5);
    });
  });
});
