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
});
