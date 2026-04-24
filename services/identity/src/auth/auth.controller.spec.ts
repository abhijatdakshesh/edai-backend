import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, type LoginResponse, type TokenPair } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto, RefreshDto, LogoutDto } from '../dto/auth.dto';
import { UnauthorizedException } from '@nestjs/common';

// ─── Mock AuthService ─────────────────────────────────────────────────────────

const mockLoginResponse: LoginResponse = {
  accessToken: 'mock.access.token',
  refreshToken: 'mock.refresh.token',
  expiresIn: 900,
  user: {
    id: 'u-admin-01',
    name: 'Admin User',
    email: 'admin@rvce.edu',
    role: 'ADMIN',
    institutionId: 'rvce',
    preferredLanguage: 'en',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
};

const mockRefreshResult: Pick<TokenPair, 'accessToken' | 'expiresIn'> = {
  accessToken: 'new.mock.access.token',
  expiresIn: 900,
};

const mockAuthService = {
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  validatePayload: jest.fn(),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      // Override guards so we don't need a real JWT in controller unit tests
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ─── login ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('delegates to authService.login with email and password from DTO', async () => {
      mockAuthService.login.mockResolvedValueOnce(mockLoginResponse);

      const dto: LoginDto = { email: 'admin@rvce.edu', password: 'Admin@123' };
      const result = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
      expect(mockAuthService.login).toHaveBeenCalledWith('admin@rvce.edu', 'Admin@123');
      expect(result).toBe(mockLoginResponse);
    });

    it('returns the full LoginResponse including user object', async () => {
      mockAuthService.login.mockResolvedValueOnce(mockLoginResponse);

      const result = await controller.login({ email: 'admin@rvce.edu', password: 'Admin@123' });

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toBe('mock.refresh.token');
      expect(result.expiresIn).toBe(900);
      expect(result.user.role).toBe('ADMIN');
    });

    it('propagates UnauthorizedException from authService.login', async () => {
      mockAuthService.login.mockRejectedValueOnce(new UnauthorizedException('Invalid credentials'));

      await expect(
        controller.login({ email: 'admin@rvce.edu', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('passes raw DTO values without transformation', async () => {
      mockAuthService.login.mockResolvedValueOnce(mockLoginResponse);
      const dto: LoginDto = { email: 'Teacher@Rvce.Edu', password: 'Pass123!' };
      await controller.login(dto);
      expect(mockAuthService.login).toHaveBeenCalledWith('Teacher@Rvce.Edu', 'Pass123!');
    });
  });

  // ─── refresh ────────────────────────────────────────────────────────────────

  describe('refresh()', () => {
    it('delegates to authService.refresh with the refreshToken from DTO', async () => {
      mockAuthService.refresh.mockReturnValueOnce(mockRefreshResult);

      const dto: RefreshDto = { refreshToken: 'mock.refresh.token' };
      const result = await controller.refresh(dto);

      expect(mockAuthService.refresh).toHaveBeenCalledTimes(1);
      expect(mockAuthService.refresh).toHaveBeenCalledWith('mock.refresh.token');
      expect(result).toBe(mockRefreshResult);
    });

    it('returns accessToken and expiresIn from the service result', async () => {
      mockAuthService.refresh.mockReturnValueOnce(mockRefreshResult);

      const result = await controller.refresh({ refreshToken: 'some.token' });

      expect(result.accessToken).toBe('new.mock.access.token');
      expect(result.expiresIn).toBe(900);
    });

    it('propagates UnauthorizedException from authService.refresh', async () => {
      mockAuthService.refresh.mockImplementationOnce(() => {
        throw new UnauthorizedException('Invalid or expired refresh token');
      });

      expect(() => controller.refresh({ refreshToken: 'bad.token' })).toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── logout ─────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('delegates to authService.logout with the refreshToken from DTO', async () => {
      mockAuthService.logout.mockReturnValueOnce({ ok: true });

      const dto: LogoutDto = { refreshToken: 'mock.refresh.token' };
      const result = await controller.logout(dto);

      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
      expect(mockAuthService.logout).toHaveBeenCalledWith('mock.refresh.token');
      expect(result).toEqual({ ok: true });
    });

    it('returns { ok: true } exactly as the service returns', async () => {
      mockAuthService.logout.mockReturnValueOnce({ ok: true });
      const result = await controller.logout({ refreshToken: 'any.token' });
      expect(result).toEqual({ ok: true });
    });

    it('calls logout with an empty string if provided', async () => {
      mockAuthService.logout.mockReturnValueOnce({ ok: true });
      await controller.logout({ refreshToken: '' });
      expect(mockAuthService.logout).toHaveBeenCalledWith('');
    });
  });

  // ─── me ─────────────────────────────────────────────────────────────────────

  describe('me()', () => {
    it('returns req.user directly without calling any service method', () => {
      const mockUser = mockLoginResponse.user;
      const req = { user: mockUser } as unknown as Parameters<typeof controller.me>[0];

      const result = controller.me(req);

      expect(result).toBe(mockUser);
      // me() must not touch authService at all
      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('returns the full user object attached to the request', () => {
      const user = {
        id: 'u-student-01',
        name: 'Arjun Kumar',
        email: 'student@rvce.edu',
        role: 'STUDENT' as const,
        institutionId: 'rvce',
        preferredLanguage: 'en' as const,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      const req = { user } as unknown as Parameters<typeof controller.me>[0];
      const result = controller.me(req);
      expect(result.id).toBe('u-student-01');
      expect(result.role).toBe('STUDENT');
    });
  });

  // ─── keycloakCallback ───────────────────────────────────────────────────────

  describe('keycloakCallback()', () => {
    it('returns { status: "keycloak_callback_acknowledged" }', () => {
      const result = controller.keycloakCallback();
      expect(result).toEqual({ status: 'keycloak_callback_acknowledged' });
    });

    it('does not call any authService method', () => {
      controller.keycloakCallback();
      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });
  });
});
