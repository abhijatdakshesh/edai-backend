import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConsentService } from './consent.service';

describe('ConsentService — DPDP Act 2023 compliance', () => {
  let service: ConsentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConsentService],
    }).compile();
    service = module.get<ConsentService>(ConsentService);
  });

  describe('grant()', () => {
    it('creates a new consent record for a principal', () => {
      const record = service.grant('USN001', ['ATTENDANCE_ALERTS'], 'rvce');
      expect(record.principalId).toBe('USN001');
      expect(record.channels).toContain('ATTENDANCE_ALERTS');
      expect(record.active).toBe(true);
      expect(record.institutionId).toBe('rvce');
    });

    it('merges channels if consent record already exists', () => {
      service.grant('USN001', ['ATTENDANCE_ALERTS'], 'rvce');
      const record = service.grant('USN001', ['FEES_ALERTS'], 'rvce');
      expect(record.channels).toContain('ATTENDANCE_ALERTS');
      expect(record.channels).toContain('FEES_ALERTS');
    });

    it('defaults institutionId to "default" when not provided', () => {
      const record = service.grant('USN002', ['GENERAL']);
      expect(record.institutionId).toBe('default');
    });

    it('does not create duplicate channel entries on re-grant', () => {
      service.grant('USN003', ['ATTENDANCE_ALERTS'], 'rvce');
      const record = service.grant('USN003', ['ATTENDANCE_ALERTS'], 'rvce');
      expect(record.channels.filter((c) => c === 'ATTENDANCE_ALERTS')).toHaveLength(1);
    });
  });

  describe('assertConsent()', () => {
    it('throws ForbiddenException when no consent record exists', () => {
      expect(() => service.assertConsent('USN_NO_CONSENT', 'ATTENDANCE_ALERTS', 'rvce'))
        .toThrow(ForbiddenException);
    });

    it('does not throw when valid consent exists for the channel', () => {
      service.grant('USN001', ['ATTENDANCE_ALERTS'], 'rvce');
      expect(() => service.assertConsent('USN001', 'ATTENDANCE_ALERTS', 'rvce')).not.toThrow();
    });

    it('throws when consent exists but not for the requested channel', () => {
      service.grant('USN001', ['FEES_ALERTS'], 'rvce');
      expect(() => service.assertConsent('USN001', 'ATTENDANCE_ALERTS', 'rvce'))
        .toThrow(ForbiddenException);
    });

    it('throws after consent is revoked — DPDP revocation honoured immediately', () => {
      service.grant('USN001', ['ATTENDANCE_ALERTS'], 'rvce');
      service.revoke('USN001', ['ATTENDANCE_ALERTS'], 'rvce');
      expect(() => service.assertConsent('USN001', 'ATTENDANCE_ALERTS', 'rvce'))
        .toThrow(ForbiddenException);
    });

    it('isolates consent per institution — RVCE consent does not bleed into RVITM', () => {
      service.grant('USN001', ['ATTENDANCE_ALERTS'], 'rvce');
      expect(() => service.assertConsent('USN001', 'ATTENDANCE_ALERTS', 'rvitm'))
        .toThrow(ForbiddenException);
    });
  });

  describe('revoke()', () => {
    it('removes specific channels from consent record', () => {
      service.grant('USN001', ['ATTENDANCE_ALERTS', 'FEES_ALERTS'], 'rvce');
      service.revoke('USN001', ['ATTENDANCE_ALERTS'], 'rvce');
      expect(service.hasConsent('USN001', 'ATTENDANCE_ALERTS', 'rvce')).toBe(false);
      expect(service.hasConsent('USN001', 'FEES_ALERTS', 'rvce')).toBe(true);
    });

    it('deactivates record when all channels revoked', () => {
      service.grant('USN001', ['ATTENDANCE_ALERTS'], 'rvce');
      service.revoke('USN001', ['ATTENDANCE_ALERTS'], 'rvce');
      const record = service.getConsent('USN001', 'rvce');
      expect(record).toBeNull();
    });

    it('is a no-op for unknown principalId', () => {
      expect(() => service.revoke('NO_SUCH', ['GENERAL'])).not.toThrow();
    });
  });

  describe('revokeAll()', () => {
    it('deactivates record and clears all channels', () => {
      service.grant('USN001', ['ATTENDANCE_ALERTS', 'FEES_ALERTS', 'GENERAL'], 'rvce');
      service.revokeAll('USN001', 'rvce');
      expect(service.getConsent('USN001', 'rvce')).toBeNull();
    });

    it('sets revokedAt timestamp', () => {
      service.grant('USN001', ['GENERAL'], 'rvce');
      service.revokeAll('USN001', 'rvce');
      const record = service.records.find((r) => r.principalId === 'USN001');
      expect(record?.revokedAt).toBeDefined();
    });
  });

  describe('hasConsent()', () => {
    it('returns true when consent exists for the channel', () => {
      service.grant('P1', ['FEES_ALERTS'], 'rvce');
      expect(service.hasConsent('P1', 'FEES_ALERTS', 'rvce')).toBe(true);
    });

    it('returns false for a channel not consented to', () => {
      service.grant('P1', ['FEES_ALERTS'], 'rvce');
      expect(service.hasConsent('P1', 'MARKS_ALERTS', 'rvce')).toBe(false);
    });

    it('returns false after revokeAll', () => {
      service.grant('P1', ['FEES_ALERTS'], 'rvce');
      service.revokeAll('P1', 'rvce');
      expect(service.hasConsent('P1', 'FEES_ALERTS', 'rvce')).toBe(false);
    });

    it('returns false for unknown principal', () => {
      expect(service.hasConsent('UNKNOWN', 'GENERAL', 'rvce')).toBe(false);
    });
  });

  describe('revokeAll() — edge cases', () => {
    it('is a no-op when principal has no active record', () => {
      expect(() => service.revokeAll('NO_SUCH_USER', 'rvce')).not.toThrow();
    });

    it('sets channels to empty array', () => {
      service.grant('P2', ['GENERAL', 'FEES_ALERTS'], 'rvce');
      service.revokeAll('P2', 'rvce');
      const record = service.records.find((r) => r.principalId === 'P2');
      expect(record?.channels).toEqual([]);
    });
  });

  describe('getConsent()', () => {
    it('returns null for unknown principal', () => {
      expect(service.getConsent('NOBODY', 'default')).toBeNull();
    });

    it('returns null after revokeAll', () => {
      service.grant('P3', ['GENERAL'], 'default');
      service.revokeAll('P3', 'default');
      expect(service.getConsent('P3', 'default')).toBeNull();
    });

    it('returns record when active consent exists', () => {
      service.grant('P4', ['GENERAL'], 'default');
      const result = service.getConsent('P4', 'default');
      expect(result).not.toBeNull();
      expect(result?.principalId).toBe('P4');
    });
  });

  describe('assertConsent() — granted channel', () => {
    it('does NOT throw when consent is granted for the channel', () => {
      service.grant('P5', ['MARKS_ALERTS'], 'default');
      expect(() => service.assertConsent('P5', 'MARKS_ALERTS', 'default')).not.toThrow();
    });

    it('throws when consented to a different channel only', () => {
      service.grant('P6', ['FEES_ALERTS'], 'default');
      expect(() => service.assertConsent('P6', 'MARKS_ALERTS', 'default')).toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // Default-institutionId branch coverage — every public method has a default
  // institutionId = 'default'. Calling without the arg covers the missing
  // default-value branch in v8 coverage.
  // ---------------------------------------------------------------------------
  describe('default institutionId branch (omitted argument)', () => {
    it('grant() defaults institutionId to "default" when omitted', () => {
      const r = service.grant('PD1', ['VOICE']);
      expect(r.institutionId).toBe('default');
    });
    it('revoke() defaults institutionId to "default" when omitted', () => {
      service.grant('PD2', ['VOICE']);
      service.revoke('PD2', ['VOICE']);
      expect(service.getConsent('PD2')).toBeNull();
    });
    it('revokeAll() defaults institutionId to "default" when omitted', () => {
      service.grant('PD3', ['VOICE']);
      service.revokeAll('PD3');
      expect(service.getConsent('PD3')).toBeNull();
    });
    it('assertConsent() defaults institutionId to "default" when omitted', () => {
      service.grant('PD4', ['VOICE']);
      expect(() => service.assertConsent('PD4', 'VOICE')).not.toThrow();
    });
    it('hasConsent() defaults institutionId to "default" when omitted', () => {
      service.grant('PD5', ['VOICE']);
      expect(service.hasConsent('PD5', 'VOICE')).toBe(true);
    });
    it('getConsent() defaults institutionId to "default" when omitted', () => {
      service.grant('PD6', ['VOICE']);
      expect(service.getConsent('PD6')?.principalId).toBe('PD6');
    });
  });

  // ---------------------------------------------------------------------------
  // VOICE channel — DPDP gate for the new interactive voice-call feature.
  // ---------------------------------------------------------------------------
  describe('VOICE channel — covers the new ConsentChannel union member', () => {
    it('grants VOICE consent and assertConsent passes', () => {
      service.grant('USN_VOICE', ['VOICE'], 'rvce');
      expect(() => service.assertConsent('USN_VOICE', 'VOICE', 'rvce')).not.toThrow();
      expect(service.hasConsent('USN_VOICE', 'VOICE', 'rvce')).toBe(true);
    });

    it('mid-call revocation: assertConsent throws immediately after revoke(VOICE)', () => {
      service.grant('USN_VOICE', ['VOICE', 'GENERAL'], 'rvce');
      service.revoke('USN_VOICE', ['VOICE'], 'rvce');
      expect(() => service.assertConsent('USN_VOICE', 'VOICE', 'rvce')).toThrow(ForbiddenException);
      // GENERAL consent untouched — record still active.
      expect(service.hasConsent('USN_VOICE', 'GENERAL', 'rvce')).toBe(true);
    });

    it('idempotency: double-grant of VOICE keeps a single channel entry', () => {
      service.grant('USN_VOICE2', ['VOICE'], 'rvce');
      const second = service.grant('USN_VOICE2', ['VOICE'], 'rvce');
      expect(second.channels.filter((c) => c === 'VOICE')).toHaveLength(1);
    });

    it('revokeAll wipes VOICE consent and getConsent returns null', () => {
      service.grant('USN_VOICE3', ['VOICE'], 'rvce');
      service.revokeAll('USN_VOICE3', 'rvce');
      expect(service.getConsent('USN_VOICE3', 'rvce')).toBeNull();
      expect(service.hasConsent('USN_VOICE3', 'VOICE', 'rvce')).toBe(false);
    });

    it('channels-array immutability: grant returns a new merged array, original input not mutated', () => {
      const inputChannels: any = ['VOICE'];
      service.grant('USN_VOICE4', inputChannels, 'rvce');
      service.grant('USN_VOICE4', ['GENERAL'], 'rvce');
      // Caller's original array must not be mutated by the service.
      expect(inputChannels).toEqual(['VOICE']);
    });
  });

  // ---------------------------------------------------------------------------
  // DB-backed write-through path — hits hydrateFromDb (lines 35, 44-59),
  // grant UPDATE (line 71), grant INSERT (line 83), revoke deactivate (line 98),
  // revoke partial (line 103), revokeAll (line 118).
  // ---------------------------------------------------------------------------
  describe('write-through DB persistence (DataSource present)', () => {
    let mockDs: any;
    let queryMock: jest.Mock;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      queryMock = jest.fn().mockResolvedValue([]);
      mockDs = { query: queryMock };
      // Silence Logger.warn so the catch-branch tests don't pollute test output.
      warnSpy = jest
        .spyOn((require('@nestjs/common').Logger as any).prototype, 'warn')
        .mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('hydrates the in-memory cache from DB rows on construction (lines 44-59)', async () => {
      // First call = the hydration SELECT
      queryMock.mockResolvedValueOnce([
        {
          principal_id: 'USN_HYD',
          institution_id: 'rvce',
          channels: ['VOICE', 'GENERAL'],
          granted_at: '2026-01-01T00:00:00.000Z',
          revoked_at: null,
          active: true,
        },
      ]);

      const svc = new (require('./consent.service').ConsentService)(mockDs);
      // Wait for the unawaited hydration promise to settle.
      await new Promise((r) => setImmediate(r));

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('SELECT principal_id, institution_id, channels'),
      );
      expect(svc.hasConsent('USN_HYD', 'VOICE', 'rvce')).toBe(true);
      expect(svc.hasConsent('USN_HYD', 'GENERAL', 'rvce')).toBe(true);
    });

    it('logs a warning when hydration query rejects (line 35 catch path)', async () => {
      queryMock.mockRejectedValueOnce(new Error('connection refused'));

      // eslint-disable-next-line no-new
      new (require('./consent.service').ConsentService)(mockDs);
      await new Promise((r) => setImmediate(r));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Consent hydration skipped'),
        expect.any(Error),
      );
    });

    it('issues an INSERT on first grant() and tolerates a rejected promise (line 83 catch)', async () => {
      // hydration SELECT → resolves []
      queryMock.mockResolvedValueOnce([]);
      const svc = new (require('./consent.service').ConsentService)(mockDs);
      await new Promise((r) => setImmediate(r));

      // INSERT promise rejects — the .catch on line 83 must swallow it.
      queryMock.mockRejectedValueOnce(new Error('unique violation'));
      svc.grant('USN_INS', ['VOICE'], 'rvce');
      await new Promise((r) => setImmediate(r));

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO consent_records'),
        expect.arrayContaining(['USN_INS', 'rvce', ['VOICE']]),
      );
      expect(warnSpy).toHaveBeenCalledWith('Consent insert failed', expect.any(Error));
    });

    it('issues an UPDATE on re-grant() and tolerates a rejected promise (line 71 catch)', async () => {
      queryMock.mockResolvedValueOnce([]); // hydration
      const svc = new (require('./consent.service').ConsentService)(mockDs);
      await new Promise((r) => setImmediate(r));

      queryMock.mockResolvedValueOnce(undefined); // initial INSERT — resolves
      svc.grant('USN_UPD', ['VOICE'], 'rvce');
      await new Promise((r) => setImmediate(r));

      queryMock.mockRejectedValueOnce(new Error('deadlock')); // UPDATE rejects
      svc.grant('USN_UPD', ['GENERAL'], 'rvce');
      await new Promise((r) => setImmediate(r));

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE consent_records SET channels = $1'),
        expect.any(Array),
      );
      expect(warnSpy).toHaveBeenCalledWith('Consent update failed', expect.any(Error));
    });

    it('issues a deactivate UPDATE when revoke() drops all channels and tolerates rejection (line 98 catch)', async () => {
      queryMock.mockResolvedValueOnce([]); // hydration
      const svc = new (require('./consent.service').ConsentService)(mockDs);
      await new Promise((r) => setImmediate(r));

      queryMock.mockResolvedValueOnce(undefined); // INSERT
      svc.grant('USN_REV', ['VOICE'], 'rvce');
      await new Promise((r) => setImmediate(r));

      queryMock.mockRejectedValueOnce(new Error('db gone'));
      svc.revoke('USN_REV', ['VOICE'], 'rvce');
      await new Promise((r) => setImmediate(r));

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('SET active = false, revoked_at = NOW()'),
        expect.any(Array),
      );
      expect(warnSpy).toHaveBeenCalledWith('Consent revoke failed', expect.any(Error));
    });

    it('issues a channel-trim UPDATE when revoke() removes some channels and tolerates rejection (line 103 catch)', async () => {
      queryMock.mockResolvedValueOnce([]); // hydration
      const svc = new (require('./consent.service').ConsentService)(mockDs);
      await new Promise((r) => setImmediate(r));

      queryMock.mockResolvedValueOnce(undefined); // INSERT
      svc.grant('USN_TRIM', ['VOICE', 'GENERAL'], 'rvce');
      await new Promise((r) => setImmediate(r));

      queryMock.mockRejectedValueOnce(new Error('lock timeout'));
      svc.revoke('USN_TRIM', ['VOICE'], 'rvce'); // GENERAL remains
      await new Promise((r) => setImmediate(r));

      expect(warnSpy).toHaveBeenCalledWith('Consent channel update failed', expect.any(Error));
    });

    it('issues a revokeAll UPDATE and tolerates rejection (line 118 catch)', async () => {
      queryMock.mockResolvedValueOnce([]); // hydration
      const svc = new (require('./consent.service').ConsentService)(mockDs);
      await new Promise((r) => setImmediate(r));

      queryMock.mockResolvedValueOnce(undefined); // INSERT
      svc.grant('USN_REVALL', ['VOICE'], 'rvce');
      await new Promise((r) => setImmediate(r));

      queryMock.mockRejectedValueOnce(new Error('connection reset'));
      svc.revokeAll('USN_REVALL', 'rvce');
      await new Promise((r) => setImmediate(r));

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining(`SET active = false, channels = '{}'`),
        expect.any(Array),
      );
      expect(warnSpy).toHaveBeenCalledWith('Consent revokeAll failed', expect.any(Error));
    });
  });
});
