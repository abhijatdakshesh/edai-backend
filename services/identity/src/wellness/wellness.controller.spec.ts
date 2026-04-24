import { Test, TestingModule } from '@nestjs/testing';
import { WellnessController } from './wellness.controller';
import { WellnessService } from './wellness.service';

const mockSvc = {
  getSlots: jest.fn(),
  getMySessions: jest.fn(),
  bookSession: jest.fn(),
  getRiskScore: jest.fn(),
  getStudyPlan: jest.fn(),
  updateTask: jest.fn(),
  getResources: jest.fn(),
};

describe('WellnessController', () => {
  let controller: WellnessController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WellnessController],
      providers: [{ provide: WellnessService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WellnessController>(WellnessController);
  });

  it('getSlots delegates to service', () => {
    mockSvc.getSlots.mockReturnValue([]);
    expect(controller.getSlots()).toEqual([]);
  });

  it('getMySessions uses sapId from request', () => {
    mockSvc.getMySessions.mockReturnValue([]);
    controller.getMySessions({ user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.getMySessions).toHaveBeenCalledWith('SAP001');
  });

  it('getMySessions falls back to sub when sapId absent', () => {
    mockSvc.getMySessions.mockReturnValue([]);
    controller.getMySessions({ user: { sub: 'u1' } });
    expect(mockSvc.getMySessions).toHaveBeenCalledWith('u1');
  });

  it('bookSession uses sapId and delegates body', () => {
    const session = { id: 'sess-1', status: 'BOOKED' };
    mockSvc.bookSession.mockReturnValue(session);
    const result = controller.bookSession({ slotId: 'slot-1', reason: 'stress' }, { user: { sapId: 'SAP001' } });
    expect(mockSvc.bookSession).toHaveBeenCalledWith('SAP001', 'slot-1', 'stress');
    expect(result).toBe(session);
  });

  it('bookSession falls back to UNKNOWN when user absent', () => {
    mockSvc.bookSession.mockReturnValue({});
    controller.bookSession({ slotId: 'slot-1', reason: 'r' }, {});
    expect(mockSvc.bookSession).toHaveBeenCalledWith('UNKNOWN', 'slot-1', 'r');
  });

  it('getRiskScore delegates with usn param', () => {
    const score = { score: 30, level: 'LOW', factors: [] };
    mockSvc.getRiskScore.mockReturnValue(score);
    expect(controller.getRiskScore('USN001')).toBe(score);
    expect(mockSvc.getRiskScore).toHaveBeenCalledWith('USN001');
  });

  it('getStudyPlan uses sapId from request', () => {
    mockSvc.getStudyPlan.mockReturnValue({ tasks: [] });
    controller.getStudyPlan({ user: { sub: 'u1' } });
    expect(mockSvc.getStudyPlan).toHaveBeenCalledWith('u1');
  });

  it('updateTask delegates with id and done', () => {
    const task = { id: 't1', done: true };
    mockSvc.updateTask.mockReturnValue(task);
    const result = controller.updateTask('t1', { done: true });
    expect(mockSvc.updateTask).toHaveBeenCalledWith('t1', true);
    expect(result).toBe(task);
  });

  it('getResources delegates to service', () => {
    mockSvc.getResources.mockReturnValue([{ title: 'Stress 101' }]);
    expect(controller.getResources()).toHaveLength(1);
  });
});
