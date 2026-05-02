import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { User } from '../entities/user.entity';
import { TokenBlocklistService } from './token-blocklist.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  institutionId: string;
  preferredLanguage: string;
  /**
   * domainId: the role-specific identifier used by domain services.
   *  - STUDENT  → students.usn          (e.g. "1RV21CS001")
   *  - FACULTY/HOD/PRINCIPAL → faculty.emp_id (e.g. "FAC001")
   *  - PARENT   → students.parent_phone  (e.g. "+919876543210")
   *  - ADMIN    → faculty.emp_id or a sentinel (e.g. "dev-admin")
   *
   * Carried in the JWT so downstream services never need a DB round-trip
   * just to resolve "which student/teacher is this?"
   * `sub` remains the auth-layer identifier (UUID in Phase 2, seed id in Phase 1).
   */
  domainId?: string;
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
    { id: 'u-admin-01',     email: 'admin@rvce.edu',     passwordHash: h('Admin@123'),     name: 'Admin User',       role: 'ADMIN',     institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-faculty-01',   email: 'teacher@rvce.edu',   passwordHash: h('Teacher@123'),   name: 'Dr. Priya Sharma', role: 'FACULTY',   institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-student-01',   email: 'student@rvce.edu',   passwordHash: h('Student@123'),   name: 'Arjun Sharma',     role: 'STUDENT',   institutionId: 'rvce', preferredLanguage: 'en', isActive: true, sapId: '1RV21CS001', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-parent-01',    email: 'parent@rvce.edu',    passwordHash: h('Parent@123'),    name: 'Suresh Sharma',    role: 'PARENT',    institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-hod-01',       email: 'hod@rvce.edu',       passwordHash: h('Hod@123'),       name: 'Dr. Meena Rao',    role: 'HOD',       institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-principal-01', email: 'principal@rvce.edu', passwordHash: h('Principal@123'), name: 'Dr. K. Venkatesh', role: 'PRINCIPAL', institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-recruiter-01', email: 'recruiter@demo.com', passwordHash: h('Recruiter@123'), name: 'Recruiter', role: 'RECRUITER', institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
})();

@Injectable()
export class AuthService {
  /** Phase 2: replace with `@InjectRepository(User) private userRepo: Repository<User>`. */
  private readonly users: User[] = SEED_USERS;

  constructor(
    private readonly jwtService: JwtService,
    private readonly blocklist: TokenBlocklistService,
  ) {}

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

  async refresh(
    incomingRefreshToken: string,
  ): Promise<Pick<TokenPair, 'accessToken' | 'expiresIn'>> {
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

    if (await this.blocklist.isBlocked(incomingRefreshToken)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = this.users.find((u) => u.id === payload.sub && u.isActive);
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const { accessToken, expiresIn } = this.issueTokens(user);
    return { accessToken, expiresIn };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<{ ok: boolean }> {
    await this.blocklist.block(refreshToken);
    return { ok: true };
  }

  // ─── Used by JwtStrategy.validate() ──────────────────────────────────────

  validatePayload(payload: JwtPayload): Omit<User, 'passwordHash'> | null {
    let user = this.users.find((u) => u.id === payload.sub && u.isActive);
    // Dev tokens use sub='dev-<role>' — fall back to email match
    if (!user && payload.sub?.startsWith('dev-')) {
      user = this.users.find((u) => u.email === payload.email && u.isActive);
    }
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
