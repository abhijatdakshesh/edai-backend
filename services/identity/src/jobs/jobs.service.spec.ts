import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobsService, Job, PlacementPrediction } from './jobs.service';

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
});
