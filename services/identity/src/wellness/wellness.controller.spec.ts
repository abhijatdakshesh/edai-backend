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
  assessStress: jest.fn(),
  generateStudyPlan: jest.fn(),
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

  it('getMySessions falls back to UNKNOWN when user absent', () => {
    mockSvc.getMySessions.mockReturnValue([]);
    controller.getMySessions({});
    expect(mockSvc.getMySessions).toHaveBeenCalledWith('UNKNOWN');
  });

  it('bookSession falls back to sub when sapId absent', () => {
    mockSvc.bookSession.mockReturnValue({});
    controller.bookSession({ slotId: 's1', reason: 'stress' }, { user: { sub: 'u2' } });
    expect(mockSvc.bookSession).toHaveBeenCalledWith('u2', 's1', 'stress');
  });

  it('bookSessionAlias uses sapId', () => {
    mockSvc.bookSession.mockReturnValue({});
    controller.bookSessionAlias({ slotId: 's1', reason: 'r' }, { user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.bookSession).toHaveBeenCalledWith('SAP001', 's1', 'r');
  });

  it('bookSessionAlias falls back to sub', () => {
    mockSvc.bookSession.mockReturnValue({});
    controller.bookSessionAlias({ slotId: 's1', reason: 'r' }, { user: { sub: 'u2' } });
    expect(mockSvc.bookSession).toHaveBeenCalledWith('u2', 's1', 'r');
  });

  it('bookSessionAlias falls back to UNKNOWN', () => {
    mockSvc.bookSession.mockReturnValue({});
    controller.bookSessionAlias({ slotId: 's1', reason: 'r' }, {});
    expect(mockSvc.bookSession).toHaveBeenCalledWith('UNKNOWN', 's1', 'r');
  });

  it('getMyRiskScore uses sapId', () => {
    mockSvc.getRiskScore.mockReturnValue({ score: 20 });
    controller.getMyRiskScore({ user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.getRiskScore).toHaveBeenCalledWith('SAP001');
  });

  it('getMyRiskScore falls back to sub', () => {
    mockSvc.getRiskScore.mockReturnValue({ score: 20 });
    controller.getMyRiskScore({ user: { sub: 'u2' } });
    expect(mockSvc.getRiskScore).toHaveBeenCalledWith('u2');
  });

  it('getMyRiskScore falls back to UNKNOWN', () => {
    mockSvc.getRiskScore.mockReturnValue({ score: 20 });
    controller.getMyRiskScore({});
    expect(mockSvc.getRiskScore).toHaveBeenCalledWith('UNKNOWN');
  });

  it('completeTask delegates id with done=true', () => {
    mockSvc.updateTask.mockReturnValue({ id: 't1', done: true });
    const result = controller.completeTask('t1');
    expect(mockSvc.updateTask).toHaveBeenCalledWith('t1', true);
    expect(result).toMatchObject({ done: true });
  });

  it('getResourcesAlias delegates to service', () => {
    mockSvc.getResources.mockReturnValue([{ title: 'Yoga Guide' }]);
    expect(controller.getResourcesAlias()).toHaveLength(1);
  });

  it('getStudyPlan falls back to UNKNOWN when user absent', () => {
    mockSvc.getStudyPlan.mockReturnValue({ tasks: [] });
    controller.getStudyPlan({});
    expect(mockSvc.getStudyPlan).toHaveBeenCalledWith('UNKNOWN');
  });

  it('getStudyPlan uses sapId when present', () => {
    mockSvc.getStudyPlan.mockReturnValue({ tasks: [] });
    controller.getStudyPlan({ user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.getStudyPlan).toHaveBeenCalledWith('SAP001');
  });

  it('stressAssessment uses sapId', () => {
    mockSvc.assessStress.mockReturnValue({ score: 5 });
    controller.stressAssessment({ answers: { q1: 3 } }, { user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.assessStress).toHaveBeenCalledWith('SAP001', { q1: 3 });
  });

  it('stressAssessment falls back to sub', () => {
    mockSvc.assessStress.mockReturnValue({ score: 5 });
    controller.stressAssessment({ answers: { q1: 2 } }, { user: { sub: 'u2' } });
    expect(mockSvc.assessStress).toHaveBeenCalledWith('u2', { q1: 2 });
  });

  it('stressAssessment falls back to UNKNOWN', () => {
    mockSvc.assessStress.mockReturnValue({ score: 5 });
    controller.stressAssessment({ answers: {} }, {});
    expect(mockSvc.assessStress).toHaveBeenCalledWith('UNKNOWN', {});
  });

  it('generateStudyPlan uses sapId', () => {
    mockSvc.generateStudyPlan.mockReturnValue({ plan: [] });
    controller.generateStudyPlan({ examDate: '2026-05-01', subjects: ['CS301'] }, { user: { sapId: 'SAP001', sub: 'u1' } });
    expect(mockSvc.generateStudyPlan).toHaveBeenCalledWith('SAP001', '2026-05-01', ['CS301']);
  });

  it('generateStudyPlan falls back to sub', () => {
    mockSvc.generateStudyPlan.mockReturnValue({ plan: [] });
    controller.generateStudyPlan({ examDate: '2026-05-01', subjects: [] }, { user: { sub: 'u2' } });
    expect(mockSvc.generateStudyPlan).toHaveBeenCalledWith('u2', '2026-05-01', []);
  });

  it('generateStudyPlan falls back to UNKNOWN', () => {
    mockSvc.generateStudyPlan.mockReturnValue({ plan: [] });
    controller.generateStudyPlan({ examDate: '2026-05-01', subjects: [] }, {});
    expect(mockSvc.generateStudyPlan).toHaveBeenCalledWith('UNKNOWN', '2026-05-01', []);
  });
});
