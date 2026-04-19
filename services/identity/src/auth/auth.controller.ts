import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto, RefreshDto, LogoutDto } from '../dto/auth.dto';
import type { User } from '../entities/user.entity';

interface AuthenticatedRequest extends Request {
  user: Omit<User, 'passwordHash'>;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Body: { email, password }
   * Returns: { accessToken, refreshToken, expiresIn, user }
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * POST /api/auth/refresh
   * Body: { refreshToken }
   * Returns: { accessToken, expiresIn }
   *
   * Call when a request returns 401. Refresh tokens are single-use (rotated).
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * POST /api/auth/logout
   * Body: { refreshToken }
   * Invalidates the refresh token server-side.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  /**
   * GET /api/auth/me
   * Header: Authorization: Bearer <accessToken>
   * Returns the authenticated user's full profile (without passwordHash).
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest): Omit<User, 'passwordHash'> {
    return req.user;
  }

  /**
   * GET /api/auth/callback
   * Keycloak OIDC redirect — exchange code for tokens in Phase 2.
   */
  @Get('callback')
  keycloakCallback(): { status: string } {
    return { status: 'keycloak_callback_acknowledged' };
  }
}
