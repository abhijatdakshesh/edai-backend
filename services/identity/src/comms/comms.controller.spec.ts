import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';
import { ConsentService } from './consent.service';
import { StudentPortalService } from '../student-portal/student-portal.service';

const mockCommsService = {
  getRecentCalls: jest.fn(),
  getParentCalls: jest.fn(),
  getParentMessages: jest.fn(),
  getAdminCallLogs: jest.fn(),
  getAnnouncements: jest.fn(),
  getCallsByClass: jest.fn(),
  triggerCall: jest.fn(),
  sendSms: jest.fn(),
  createAnnouncement: jest.fn(),
  triggerParentCall: jest.fn(),
  getNotifications: jest.fn(),
  markAllRead: jest.fn(),
  markNotificationRead: jest.fn(),
};

const mockStudentPortalService = {
  getDashboard: jest.fn(),
  getSchedule: jest.fn(),
  getHostel: jest.fn(),
  getExamPrep: jest.fn(),
  getStaff: jest.fn(),
};

describe('CommsController', () => {
  let controller: CommsController;
  let consentSvc: ConsentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommsController],
      providers: [
        { provide: CommsService, useValue: mockCommsService },
        ConsentService,
        { provide: StudentPortalService, useValue: mockStudentPortalService },
      ],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CommsController>(CommsController);
    consentSvc = module.get<ConsentService>(ConsentService);
  });

  it('getRecentCalls delegates to service', () => {
    mockCommsService.getRecentCalls.mockReturnValue([]);
    expect(controller.getRecentCalls()).toEqual([]);
    expect(mockCommsService.getRecentCalls).toHaveBeenCalled();
  });

  // ─── getParentCalls ──────────────────────────────────────────────────────────

  it('getParentCalls delegates with parentId from JWT', () => {
    mockCommsService.getParentCalls.mockReturnValue([]);
    controller.getParentCalls({ user: { sub: 'parent-1', institutionId: 'default' } });
    expect(mockCommsService.getParentCalls).toHaveBeenCalledWith('parent-1', 'default');
  });

  it('getParentCalls falls back to unknown sub when user absent', () => {
    mockCommsService.getParentCalls.mockReturnValue([]);
    controller.getParentCalls({});
    expect(mockCommsService.getParentCalls).toHaveBeenCalledWith('unknown', undefined);
  });

  it('getParentCalls uses env INSTITUTION_ID when institutionId absent from user', () => {
    process.env['INSTITUTION_ID'] = 'env-inst';
    mockCommsService.getParentCalls.mockReturnValue([]);
    controller.getParentCalls({ user: { sub: 'p1' } });
    expect(mockCommsService.getParentCalls).toHaveBeenCalledWith('p1', 'env-inst');
    delete process.env['INSTITUTION_ID'];
  });

  // ─── getParentMessages ───────────────────────────────────────────────────────

  it('getParentMessages delegates with parentId from JWT', () => {
    mockCommsService.getParentMessages.mockReturnValue([]);
    controller.getParentMessages({ user: { sub: 'parent-1' } });
    expect(mockCommsService.getParentMessages).toHaveBeenCalledWith('parent-1');
  });

  it('getParentMessages falls back to unknown when user absent', () => {
    mockCommsService.getParentMessages.mockReturnValue([]);
    controller.getParentMessages({});
    expect(mockCommsService.getParentMessages).toHaveBeenCalledWith('unknown');
  });

  // ─── getAdminCallLogs ────────────────────────────────────────────────────────

  it('getAdminCallLogs delegates with institutionId from JWT', () => {
    mockCommsService.getAdminCallLogs.mockReturnValue([]);
    expect(controller.getAdminCallLogs({ user: { institutionId: 'default' } })).toEqual([]);
  });

  it('getAdminCallLogs uses env INSTITUTION_ID when absent from user', () => {
    process.env['INSTITUTION_ID'] = 'env-admin';
    mockCommsService.getAdminCallLogs.mockReturnValue([]);
    controller.getAdminCallLogs({ user: {} });
    expect(mockCommsService.getAdminCallLogs).toHaveBeenCalledWith('env-admin');
    delete process.env['INSTITUTION_ID'];
  });

  // ─── getAnnouncements ────────────────────────────────────────────────────────

  it('getAnnouncements throws BadRequestException when institutionId not resolvable', () => {
    const origEnv = process.env.INSTITUTION_ID;
    delete process.env.INSTITUTION_ID;
    expect(() => controller.getAnnouncements({ user: {} })).toThrow(BadRequestException);
    if (origEnv) process.env.INSTITUTION_ID = origEnv;
  });

  it('getAnnouncements delegates with institutionId from JWT', () => {
    mockCommsService.getAnnouncements.mockReturnValue([]);
    controller.getAnnouncements({ user: { institutionId: 'rvce' } });
    expect(mockCommsService.getAnnouncements).toHaveBeenCalledWith('rvce');
  });

  it('getAnnouncements uses env INSTITUTION_ID when absent from user', () => {
    process.env.INSTITUTION_ID = 'env-inst';
    mockCommsService.getAnnouncements.mockReturnValue([]);
    controller.getAnnouncements({ user: {} });
    expect(mockCommsService.getAnnouncements).toHaveBeenCalledWith('env-inst');
    delete process.env.INSTITUTION_ID;
  });

  // ─── getCallsByClass ─────────────────────────────────────────────────────────

  it('getCallsByClass throws BadRequestException when classId missing', () => {
    expect(() => controller.getCallsByClass(undefined as any, { user: { institutionId: 'rvce' } })).toThrow(BadRequestException);
  });

  it('getCallsByClass throws BadRequestException when institutionId not resolvable', () => {
    const origEnv = process.env.INSTITUTION_ID;
    delete process.env.INSTITUTION_ID;
    expect(() => controller.getCallsByClass('class-1', { user: {} })).toThrow(BadRequestException);
    if (origEnv) process.env.INSTITUTION_ID = origEnv;
  });

  it('getCallsByClass delegates with classId and institutionId', () => {
    mockCommsService.getCallsByClass.mockReturnValue([]);
    controller.getCallsByClass('class-1', { user: { institutionId: 'rvce' } });
    expect(mockCommsService.getCallsByClass).toHaveBeenCalledWith('class-1', 'rvce');
  });

  it('getCallsByClass uses env institutionId when absent from user', () => {
    process.env['INSTITUTION_ID'] = 'env-cls';
    mockCommsService.getCallsByClass.mockReturnValue([]);
    controller.getCallsByClass('class-2', { user: {} });
    expect(mockCommsService.getCallsByClass).toHaveBeenCalledWith('class-2', 'env-cls');
    delete process.env['INSTITUTION_ID'];
  });

  // ─── createAnnouncement ──────────────────────────────────────────────────────

  it('createAnnouncement uses institutionId from JWT', () => {
    mockCommsService.createAnnouncement.mockReturnValue({ id: 'a1' });
    controller.createAnnouncement({ title: 'T', content: 'C', audience: 'ALL' }, { user: { institutionId: 'rvce' } });
    expect(mockCommsService.createAnnouncement).toHaveBeenCalledWith('T', 'C', 'ALL', 'rvce');
  });

  it('createAnnouncement falls back to env INSTITUTION_ID', () => {
    process.env.INSTITUTION_ID = 'env-ann';
    mockCommsService.createAnnouncement.mockReturnValue({ id: 'a2' });
    controller.createAnnouncement({ title: 'T', content: 'C', audience: 'ALL' }, { user: {} });
    expect(mockCommsService.createAnnouncement).toHaveBeenCalledWith('T', 'C', 'ALL', 'env-ann');
    delete process.env.INSTITUTION_ID;
  });

  it('createAnnouncement falls back to "default" when neither user nor env set', () => {
    const origEnv = process.env.INSTITUTION_ID;
    delete process.env.INSTITUTION_ID;
    mockCommsService.createAnnouncement.mockReturnValue({ id: 'a3' });
    controller.createAnnouncement({ title: 'T', content: 'C', audience: 'ALL' }, { user: {} });
    expect(mockCommsService.createAnnouncement).toHaveBeenCalledWith('T', 'C', 'ALL', 'default');
    if (origEnv) process.env.INSTITUTION_ID = origEnv;
  });

  // ─── triggerCall / sendSms / triggerParentCall ───────────────────────────────

  it('triggerCall delegates body to service', () => {
    mockCommsService.triggerCall.mockReturnValue({ callId: 'c1', status: 'QUEUED', scheduledAt: '' });
    const result = controller.triggerCall({ studentUsn: 'USN001', type: 'ATTENDANCE' });
    expect(mockCommsService.triggerCall).toHaveBeenCalledWith('USN001', 'ATTENDANCE');
    expect(result).toMatchObject({ status: 'QUEUED' });
  });

  it('sendSms delegates body to service', () => {
    mockCommsService.sendSms.mockReturnValue({ messageId: 'sms-1', status: 'SENT' });
    const result = controller.sendSms({ phone: '+91987', message: 'Hi' });
    expect(mockCommsService.sendSms).toHaveBeenCalledWith('+91987', 'Hi');
    expect(result).toMatchObject({ status: 'SENT' });
  });

  it('triggerParentCall delegates body to service', () => {
    mockCommsService.triggerParentCall.mockReturnValue({ callId: 'pc-1', status: 'QUEUED' });
    controller.triggerParentCall({ parentId: 'p1', studentUsn: 'USN001' });
    expect(mockCommsService.triggerParentCall).toHaveBeenCalledWith('p1', 'USN001');
  });

  // ─── notifications ───────────────────────────────────────────────────────────

  it('getNotifications uses sub from JWT', () => {
    mockCommsService.getNotifications.mockReturnValue([]);
    controller.getNotifications({ user: { sub: 'parent-1' } });
    expect(mockCommsService.getNotifications).toHaveBeenCalledWith('parent-1');
  });

  it('getNotifications falls back to unknown when user absent', () => {
    mockCommsService.getNotifications.mockReturnValue([]);
    controller.getNotifications({});
    expect(mockCommsService.getNotifications).toHaveBeenCalledWith('unknown');
  });

  it('markAllRead uses sub from JWT', () => {
    mockCommsService.markAllRead.mockReturnValue({ ok: true, count: 0 });
    controller.markAllRead({ user: { sub: 'p1' } });
    expect(mockCommsService.markAllRead).toHaveBeenCalledWith('p1');
  });

  it('markAllRead falls back to unknown when user absent', () => {
    mockCommsService.markAllRead.mockReturnValue({ ok: true, count: 0 });
    controller.markAllRead({});
    expect(mockCommsService.markAllRead).toHaveBeenCalledWith('unknown');
  });

  it('markRead delegates with notification id', () => {
    mockCommsService.markNotificationRead.mockReturnValue({ ok: true });
    controller.markRead('n-1');
    expect(mockCommsService.markNotificationRead).toHaveBeenCalledWith('n-1');
  });

  // ─── DPDP consent endpoints ──────────────────────────────────────────────────

  it('grantConsent uses sub and institutionId from JWT', () => {
    const grantSpy = jest.spyOn(consentSvc, 'grant');
    controller.grantConsent({ channels: ['ATTENDANCE_ALERTS'] }, { user: { sub: 'p1', institutionId: 'rvce' } });
    expect(grantSpy).toHaveBeenCalledWith('p1', ['ATTENDANCE_ALERTS'], 'rvce');
  });

  it('grantConsent falls back to unknown sub and env institutionId', () => {
    process.env['INSTITUTION_ID'] = 'env-consent';
    const grantSpy = jest.spyOn(consentSvc, 'grant');
    controller.grantConsent({ channels: ['ATTENDANCE_ALERTS'] }, {});
    expect(grantSpy).toHaveBeenCalledWith('unknown', ['ATTENDANCE_ALERTS'], 'env-consent');
    delete process.env['INSTITUTION_ID'];
  });

  it('grantConsent falls back to "default" when no env institutionId', () => {
    const origEnv = process.env['INSTITUTION_ID'];
    delete process.env['INSTITUTION_ID'];
    const grantSpy = jest.spyOn(consentSvc, 'grant');
    controller.grantConsent({ channels: ['ATTENDANCE_ALERTS'] }, { user: {} });
    expect(grantSpy).toHaveBeenCalledWith('unknown', ['ATTENDANCE_ALERTS'], 'default');
    if (origEnv) process.env['INSTITUTION_ID'] = origEnv;
  });

  it('revokeConsent uses sub and institutionId from JWT', () => {
    const revokeSpy = jest.spyOn(consentSvc, 'revoke');
    const result = controller.revokeConsent({ channels: ['ATTENDANCE_ALERTS'] }, { user: { sub: 'p1', institutionId: 'rvce' } });
    expect(revokeSpy).toHaveBeenCalledWith('p1', ['ATTENDANCE_ALERTS'], 'rvce');
    expect(result).toEqual({ ok: true });
  });

  it('revokeConsent falls back to unknown sub and env institutionId', () => {
    process.env['INSTITUTION_ID'] = 'env-rev';
    const revokeSpy = jest.spyOn(consentSvc, 'revoke');
    controller.revokeConsent({ channels: ['ATTENDANCE_ALERTS'] }, {});
    expect(revokeSpy).toHaveBeenCalledWith('unknown', ['ATTENDANCE_ALERTS'], 'env-rev');
    delete process.env['INSTITUTION_ID'];
  });

  it('revokeConsent falls back to "default" when no env institutionId', () => {
    const origEnv = process.env['INSTITUTION_ID'];
    delete process.env['INSTITUTION_ID'];
    const revokeSpy = jest.spyOn(consentSvc, 'revoke');
    controller.revokeConsent({ channels: ['ATTENDANCE_ALERTS'] }, { user: {} });
    expect(revokeSpy).toHaveBeenCalledWith('unknown', ['ATTENDANCE_ALERTS'], 'default');
    if (origEnv) process.env['INSTITUTION_ID'] = origEnv;
  });

  it('revokeAllConsent uses sub and institutionId from JWT and returns ok', () => {
    const revokeAllSpy = jest.spyOn(consentSvc, 'revokeAll');
    const result = controller.revokeAllConsent({ user: { sub: 'p1', institutionId: 'rvce' } });
    expect(revokeAllSpy).toHaveBeenCalledWith('p1', 'rvce');
    expect(result).toEqual({ ok: true });
  });

  it('revokeAllConsent falls back to unknown and env institutionId', () => {
    process.env['INSTITUTION_ID'] = 'env-ra';
    const revokeAllSpy = jest.spyOn(consentSvc, 'revokeAll');
    controller.revokeAllConsent({});
    expect(revokeAllSpy).toHaveBeenCalledWith('unknown', 'env-ra');
    delete process.env['INSTITUTION_ID'];
  });

  it('revokeAllConsent falls back to "default" when no env set', () => {
    const origEnv = process.env['INSTITUTION_ID'];
    delete process.env['INSTITUTION_ID'];
    const revokeAllSpy = jest.spyOn(consentSvc, 'revokeAll');
    controller.revokeAllConsent({ user: {} });
    expect(revokeAllSpy).toHaveBeenCalledWith('unknown', 'default');
    if (origEnv) process.env['INSTITUTION_ID'] = origEnv;
  });

  it('getConsent returns consent for authenticated user', () => {
    consentSvc.grant('p1', ['ATTENDANCE_ALERTS'], 'rvce');
    const result = controller.getConsent({ user: { sub: 'p1', institutionId: 'rvce' } });
    expect(result).toBeDefined();
  });

  it('getConsent returns {active: false, channels: []} when no consent record', () => {
    jest.spyOn(consentSvc, 'getConsent').mockReturnValue(undefined as any);
    const origEnv = process.env['INSTITUTION_ID'];
    delete process.env['INSTITUTION_ID'];
    const result = controller.getConsent({ user: {} });
    expect(result).toEqual({ active: false, channels: [] });
    if (origEnv) process.env['INSTITUTION_ID'] = origEnv;
  });

  it('getConsent falls back to unknown sub and env institutionId', () => {
    process.env['INSTITUTION_ID'] = 'env-gc';
    const getConsentSpy = jest.spyOn(consentSvc, 'getConsent');
    controller.getConsent({});
    expect(getConsentSpy).toHaveBeenCalledWith('unknown', 'env-gc');
    delete process.env['INSTITUTION_ID'];
  });

  it('getConsent falls back to "default" when no env set', () => {
    const origEnv = process.env['INSTITUTION_ID'];
    delete process.env['INSTITUTION_ID'];
    const getConsentSpy = jest.spyOn(consentSvc, 'getConsent');
    controller.getConsent({ user: {} });
    expect(getConsentSpy).toHaveBeenCalledWith('unknown', 'default');
    if (origEnv) process.env['INSTITUTION_ID'] = origEnv;
  });
});
