import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ParentsService } from './parents.service';
import { StudentsService } from '../students/students.service';

const mockStudentsService = { addLink: jest.fn() };

describe('ParentsService', () => {
  let service: ParentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentsService,
        { provide: StudentsService, useValue: mockStudentsService },
      ],
    }).compile();

    service = module.get<ParentsService>(ParentsService);
  });

  // ─── issueOtp ───────────────────────────────────────────────────────────────

  describe('issueOtp()', () => {
    it('returns a 6-digit OTP', () => {
      const result = service.issueOtp('p-1', 's-1');
      expect(result.otp).toMatch(/^\d{6}$/);
    });

    it('stores the OTP record', () => {
      service.issueOtp('p-1', 's-1');
      const otpStore = (service as any).otpStore;
      expect(otpStore).toHaveLength(1);
    });

    it('OTP expires in 5 minutes', () => {
      const before = Date.now();
      service.issueOtp('p-1', 's-1');
      const otpStore = (service as any).otpStore;
      const record = otpStore[0];
      expect(record.expiresAt).toBeGreaterThan(before + 4 * 60 * 1000);
      expect(record.expiresAt).toBeLessThanOrEqual(before + 5 * 60 * 1000 + 100);
    });
  });

  // ─── linkStudent ────────────────────────────────────────────────────────────

  describe('linkStudent()', () => {
    it('links student when a valid OTP exists', () => {
      const { otp } = service.issueOtp('p-1', 's-1');
      mockStudentsService.addLink.mockReturnValue({ id: 'link-1' });

      const result = service.linkStudent('p-1', 's-1', otp);
      expect(result).toEqual({ linked: true });
      expect(mockStudentsService.addLink).toHaveBeenCalledWith('p-1', 's-1');
    });

    it('removes the OTP record after successful link', () => {
      const { otp } = service.issueOtp('p-1', 's-1');
      mockStudentsService.addLink.mockReturnValue({ id: 'link-1' });
      service.linkStudent('p-1', 's-1', otp);

      const otpStore = (service as any).otpStore;
      expect(otpStore).toHaveLength(0);
    });

    it('accepts dev fallback OTP 123456 when no valid record exists', () => {
      mockStudentsService.addLink.mockReturnValue({ id: 'link-1' });
      const result = service.linkStudent('p-99', 's-99', '123456');
      expect(result).toEqual({ linked: true });
    });

    it('throws BadRequestException for wrong OTP when no record exists', () => {
      expect(() =>
        service.linkStudent('p-1', 's-1', '000000'),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException for expired OTP', () => {
      const otpStore = (service as any).otpStore;
      otpStore.push({
        parentId: 'p-1',
        studentId: 's-1',
        otp: '999999',
        expiresAt: Date.now() - 1000, // already expired
      });
      expect(() => service.linkStudent('p-1', 's-1', '999999')).toThrow(BadRequestException);
    });
  });

  // ─── findById ───────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the seeded parent p-1', () => {
      const result = service.findById('p-1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('p-1');
    });

    it('returns undefined for unknown id', () => {
      expect(service.findById('no-such-parent')).toBeUndefined();
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns a new parent with generated id', () => {
      const data = {
        userId: 'u-new',
        relation: 'MOTHER' as const,
        phoneToken: 'tok-xyz',
        preferredLanguage: 'en' as const,
        consentFlags: { voice: true, whatsapp: false, sms: true, email: true },
      };
      const result = service.create(data);
      expect(result.id).toBeDefined();
      expect(result.userId).toBe('u-new');
      expect(result.createdAt).toBeDefined();
    });
  });
});
