import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { User } from '../entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  institutionId: string;
  preferredLanguage: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse extends TokenPair {
  user: Omit<User, 'passwordHash'>;
}

/**
 * Seed users with bcrypt-hashed passwords.
 * Phase 2: replace this array with a TypeORM UserRepository query.
 *
 * Default passwords (change via env-seeded DB in production):
 *   admin@rvce.edu      → Admin@123
 *   teacher@rvce.edu    → Teacher@123
 *   student@rvce.edu    → Student@123
 *   parent@rvce.edu     → Parent@123
 *   hod@rvce.edu        → Hod@123
 *   principal@rvce.edu  → Principal@123
 */
const SEED_USERS: User[] = (() => {
  const h = (plain: string) => bcrypt.hashSync(plain, 10);
  return [
    {
      id: 'u-admin-01',
      email: 'admin@rvce.edu',
      passwordHash: h('Admin@123'),
      name: 'Admin User',
      role: 'ADMIN',
      institutionId: 'rvce',
      preferredLanguage: 'en',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'u-faculty-01',
      email: 'teacher@rvce.edu',
      passwordHash: h('Teacher@123'),
      name: 'Ravi Shankar',
      role: 'FACULTY',
      institutionId: 'rvce',
      preferredLanguage: 'en',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'u-student-01',
      email: 'student@rvce.edu',
      passwordHash: h('Student@123'),
      name: 'Arjun Kumar',
      role: 'STUDENT',
      institutionId: 'rvce',
      sapId: '1RV21CS001',
      preferredLanguage: 'en',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'u-parent-01',
      email: 'parent@rvce.edu',
      passwordHash: h('Parent@123'),
      name: 'Suresh Kumar',
      role: 'PARENT',
      institutionId: 'rvce',
      preferredLanguage: 'en',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'u-hod-01',
      email: 'hod@rvce.edu',
      passwordHash: h('Hod@123'),
      name: 'Dr. Meena Rao',
      role: 'HOD',
      institutionId: 'rvce',
      preferredLanguage: 'en',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'u-principal-01',
      email: 'principal@rvce.edu',
      passwordHash: h('Principal@123'),
      name: 'Dr. K. Venkatesh',
      role: 'PRINCIPAL',
      institutionId: 'rvce',
      preferredLanguage: 'en',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
})();

@Injectable()
export class AuthService {
  /**
   * In-memory user store.
   * Phase 2: replace with `@InjectRepository(User) private userRepo: Repository<User>`
   * injected via constructor and use `this.userRepo.findOne({ where: { email } })`.
   */
  private readonly users: User[] = SEED_USERS;

  constructor(private readonly jwtService: JwtService) {}

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = this.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    // Use consistent error to prevent email enumeration
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.issueTokens(user);
    const { passwordHash: _ph, ...safeUser } = user;

    return { ...tokens, user: safeUser };
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  refresh(
    incomingRefreshToken: string,
  ): Pick<TokenPair, 'accessToken' | 'expiresIn'> {
    let payload: { sub?: string; type?: string };
    try {
      payload = this.jwtService.verify<{ sub: string; type: string }>(
        incomingRefreshToken,
        { ignoreExpiration: false },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = this.users.find((u) => u.id === payload.sub && u.isActive);
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const { accessToken, expiresIn } = this.issueTokens(user);
    return { accessToken, expiresIn };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  // Stateless refresh tokens cannot be revoked without a blocklist.
  // Return ok:true — Phase 2 will add a Redis blocklist entry here.
  logout(_refreshToken: string): { ok: boolean } {
    return { ok: true };
  }

  // ─── Used by JwtStrategy.validate() ──────────────────────────────────────

  validatePayload(payload: JwtPayload): Omit<User, 'passwordHash'> | null {
    const user = this.users.find((u) => u.id === payload.sub && u.isActive);
    if (!user) return null;
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private issueTokens(user: User): TokenPair {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
      preferredLanguage: user.preferredLanguage,
    };

    // accessToken: 15-minute expiry (set by JwtModule signOptions)
    const accessToken = this.jwtService.sign(payload);

    // refreshToken: signed JWT, 7-day expiry, stateless — survives server restarts
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    return { accessToken, refreshToken, expiresIn: 900 };
  }
}
