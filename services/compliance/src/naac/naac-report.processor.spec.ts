/**
 * NaacReportProcessor — unit tests
 * Covers: PROCESSING → DONE path, PROCESSING → FAILED path
 */

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NaacReportProcessor } from './naac-report.processor';
import { NaacCriterionCalculatorService } from './naac-criterion-calculator.service';
import { NaacReportEntity } from './entities/naac-report.entity';

function makeRepo() {
  return {
    update: jest.fn().mockResolvedValue(undefined),
  };
}

function makeJob(data: object) {
  return { data } as never;
}

describe('NaacReportProcessor', () => {
  let processor: NaacReportProcessor;
  let reportRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    reportRepo = makeRepo();

    const module = await Test.createTestingModule({
      providers: [
        NaacReportProcessor,
        NaacCriterionCalculatorService,
        { provide: getRepositoryToken(NaacReportEntity), useValue: reportRepo },
      ],
    }).compile();

    processor = module.get(NaacReportProcessor);
    jest.clearAllMocks();
    reportRepo.update.mockResolvedValue(undefined);
  });

  it('marks report PROCESSING then DONE on success', async () => {
    const job = makeJob({ reportId: 'r-1', academicYear: '2025-2026' });
    await processor.process(job);

    expect(reportRepo.update).toHaveBeenNthCalledWith(1, 'r-1', { status: 'PROCESSING' });
    expect(reportRepo.update).toHaveBeenNthCalledWith(
      2,
      'r-1',
      expect.objectContaining({ status: 'DONE', s3Key: 'naac-reports/r-1.json' }),
    );
  });

  it('marks report FAILED and rethrows on calculator error', async () => {
    const job = makeJob({ reportId: 'r-err', academicYear: '2024-2025' });
    reportRepo.update
      .mockResolvedValueOnce(undefined) // PROCESSING
      .mockResolvedValueOnce(undefined); // FAILED

    // Force calculator to throw
    const calcSpy = jest
      .spyOn(NaacCriterionCalculatorService.prototype, 'computeCriterion2')
      .mockImplementationOnce(() => { throw new Error('calc failed'); });

    await expect(processor.process(job)).rejects.toThrow('calc failed');
    expect(reportRepo.update).toHaveBeenCalledWith(
      'r-err',
      expect.objectContaining({ status: 'FAILED', errorDetail: expect.stringContaining('calc failed') }),
    );

    calcSpy.mockRestore();
  });

  it('includes criterion scores in DONE update', async () => {
    const job = makeJob({ reportId: 'r-2', academicYear: '2025-2026' });
    await processor.process(job);

    const doneCall = reportRepo.update.mock.calls.find(
      (c: unknown[]) => (c[1] as { status: string }).status === 'DONE',
    );
    expect(doneCall).toBeDefined();
    const payload = doneCall![1] as { criterionScores: Record<string, unknown> };
    expect(payload.criterionScores).toHaveProperty('criterion2');
    expect(payload.criterionScores).toHaveProperty('criterion3');
  });
});
