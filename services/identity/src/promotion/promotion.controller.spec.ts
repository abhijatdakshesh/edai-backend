import { Test, TestingModule } from '@nestjs/testing';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';

const mockSvc = {
  getBatches: jest.fn(),
  generate: jest.fn(),
  getDetentionList: jest.fn(),
  getBatchById: jest.fn(),
  promote: jest.fn(),
  override: jest.fn(),
};

describe('PromotionController', () => {
  let controller: PromotionController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromotionController],
      providers: [{ provide: PromotionService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../roles/roles.guard').RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PromotionController>(PromotionController);
  });

  it('getBatches delegates to service', () => {
    mockSvc.getBatches.mockReturnValue([]);
    expect(controller.getBatches()).toEqual([]);
  });

  it('generate delegates with semester and dept', () => {
    const batch = { id: 'p1', status: 'PENDING' };
    mockSvc.generate.mockReturnValue(batch);
    expect(controller.generate({ semester: 5, dept: 'CSE' })).toBe(batch);
    expect(mockSvc.generate).toHaveBeenCalledWith(5, 'CSE');
  });

  it('getDetentionList passes undefined semester when not provided', () => {
    mockSvc.getDetentionList.mockReturnValue([]);
    controller.getDetentionList('CSE', undefined);
    expect(mockSvc.getDetentionList).toHaveBeenCalledWith('CSE', undefined);
  });

  it('getDetentionList parses semester string to int', () => {
    mockSvc.getDetentionList.mockReturnValue([]);
    controller.getDetentionList('CSE', '5');
    expect(mockSvc.getDetentionList).toHaveBeenCalledWith('CSE', 5);
  });

  it('getBatchById delegates with id', () => {
    const batch = { id: 'p1', dept: 'CSE' };
    mockSvc.getBatchById.mockReturnValue(batch);
    expect(controller.getBatchById('p1')).toBe(batch);
  });

  it('promote delegates with id', async () => {
    mockSvc.promote.mockResolvedValue({ ok: true, batchId: 'p1', promotedAt: '' });
    const result = await controller.promote('p1');
    expect(result).toMatchObject({ ok: true });
    expect(mockSvc.promote).toHaveBeenCalledWith('p1');
  });

  it('override delegates with id and overrides', async () => {
    mockSvc.override.mockResolvedValue({ ok: true, overrideCount: 1 });
    const result = await controller.override('p1', { overrides: [{ usn: 'USN001', decision: 'PROMOTE' }] });
    expect(result).toMatchObject({ ok: true, overrideCount: 1 });
    expect(mockSvc.override).toHaveBeenCalledWith('p1', [{ usn: 'USN001', decision: 'PROMOTE' }]);
  });
});
