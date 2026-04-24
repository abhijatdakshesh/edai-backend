import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService, JwtPayload } from './auth.service';

const mockAuthService = {
  validatePayload: jest.fn(),
};

// Set the JWT_SECRET env var before module compilation so PassportStrategy doesn't use the default
const TEST_SECRET = 'test-jwt-secret';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env['JWT_SECRET'] = TEST_SECRET;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    delete process.env['JWT_SECRET'];
  });

  const validPayload: JwtPayload = {
    sub: 'u-admin-01',
    email: 'admin@rvce.edu',
    role: 'ADMIN',
    institutionId: 'rvce',
    preferredLanguage: 'en',
  };

  // ─── validate ───────────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('returns the safe user object for a valid payload', () => {
      const safeUser = {
        id: 'u-admin-01',
        email: 'admin@rvce.edu',
        role: 'ADMIN',
        isActive: true,
      };
      mockAuthService.validatePayload.mockReturnValue(safeUser);

      const result = strategy.validate(validPayload);
      expect(result).toBe(safeUser);
      expect(mockAuthService.validatePayload).toHaveBeenCalledWith(validPayload);
    });

    it('throws UnauthorizedException when validatePayload returns null', () => {
      mockAuthService.validatePayload.mockReturnValue(null);
      expect(() => strategy.validate(validPayload)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException with message "Token invalid or user inactive"', () => {
      mockAuthService.validatePayload.mockReturnValue(null);
      let error!: UnauthorizedException;
      try {
        strategy.validate(validPayload);
      } catch (e) {
        error = e as UnauthorizedException;
      }
      expect(error.message).toBe('Token invalid or user inactive');
    });

    it('passes the complete payload to validatePayload', () => {
      const safeUser = { id: 'u-admin-01' };
      mockAuthService.validatePayload.mockReturnValue(safeUser);
      strategy.validate(validPayload);
      expect(mockAuthService.validatePayload).toHaveBeenCalledWith(validPayload);
    });

    it('works for FACULTY role payload', () => {
      const facultyPayload: JwtPayload = {
        sub: 'u-faculty-01',
        email: 'teacher@rvce.edu',
        role: 'FACULTY',
        institutionId: 'rvce',
        preferredLanguage: 'en',
      };
      const safeUser = { id: 'u-faculty-01', role: 'FACULTY' };
      mockAuthService.validatePayload.mockReturnValue(safeUser);
      const result = strategy.validate(facultyPayload);
      expect(result).toBe(safeUser);
    });

    it('works for STUDENT role payload', () => {
      const studentPayload: JwtPayload = {
        sub: 'u-student-01',
        email: 'student@rvce.edu',
        role: 'STUDENT',
        institutionId: 'rvce',
        preferredLanguage: 'en',
      };
      const safeUser = { id: 'u-student-01', role: 'STUDENT' };
      mockAuthService.validatePayload.mockReturnValue(safeUser);
      const result = strategy.validate(studentPayload);
      expect(result).toBe(safeUser);
    });
  });
});
