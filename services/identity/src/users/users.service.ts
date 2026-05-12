import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { Language, User, UserRole } from '../entities/user.entity';
import type { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { AUTH_SEED_USERS } from '../auth/auth-seed-users';

export interface UsersListResult {
  data: Omit<User, 'passwordHash'>[];
  total: number;
  page: number;
  limit: number;
}

export interface UsersFilter {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class UsersService {
  /** In-memory store. Phase 2: replace with TypeORM UserRepository. */
  private readonly store: User[] = [
    this.seed('u-admin-01', 'Admin User', 'admin@rvce.edu', 'Admin@123', 'ADMIN', 'en'),
    this.seed('u-hod-01', 'Dr. Suresh Babu', 'hod.cse@rvce.edu', 'Hod@123', 'HOD', 'kn', 'CSE'),
    this.seed('u-faculty-01', 'Rajesh Kumar', 'teacher@rvce.edu', 'Teacher@123', 'FACULTY', 'kn', 'CSE'),
    this.seed('u-faculty-02', 'Preethi Nair', 'preethi@rvce.edu', 'Teacher@123', 'FACULTY', 'en', 'ECE'),
    this.seed('u-faculty-03', 'Mohan Das', 'mohan@rvce.edu', 'Teacher@123', 'FACULTY', 'kn', 'ME'),
    this.seed('u-student-01', 'Priya Sharma', 'student@rvce.edu', 'Student@123', 'STUDENT', 'en', 'CSE', '1RV21CS001'),
    this.seed('u-student-02', 'Arjun Reddy', 'arjun@rvce.edu', 'Student@123', 'STUDENT', 'en', 'CSE', '1RV21CS002'),
    this.seed('u-student-03', 'Kavya Gowda', 'kavya@rvce.edu', 'Student@123', 'STUDENT', 'kn', 'ECE', '1RV21EC001'),
    this.seed('u-parent-01', 'Ramesh Sharma', 'parent@rvce.edu', 'Parent@123', 'PARENT', 'en'),
    this.seed('u-counsellor-01', 'Dr. Anitha Rao', 'counsellor@rvce.edu', 'Counsellor@123', 'COUNSELLOR', 'en'),
  ];

  private seed(
    id: string,
    name: string,
    email: string,
    password: string,
    role: UserRole,
    lang: Language,
    dept?: string,
    sapId?: string,
  ): User {
    return {
      id,
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role,
      institutionId: 'rvce',
      preferredLanguage: lang,
      isActive: true,
      sapId,
      departmentCode: dept,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private safe(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  /**
   * Build the canonical merged user list.
   *
   * Sources:
   *   1. {@link UsersService.store}      — mutable, authoritative (admin CRUD)
   *   2. {@link AUTH_SEED_USERS}         — bootstrap accounts the AuthService
   *      can authenticate even if no admin has touched them
   *
   * KAN-25: previously findAll only read `store`, while AuthService had its
   * own SEED_USERS. The two stores drifted, so the admin Users table flickered
   * between counts depending on which entry won the race (e.g. parent@rvce.edu
   * exists in both stores under different ids). Dedupe is by lowercased email;
   * the mutable `store` entry always wins because it carries admin edits.
   * Output is ordered by createdAt desc for a deterministic display.
   */
  private mergedUsers(): User[] {
    const byEmail = new Map<string, User>();
    for (const u of AUTH_SEED_USERS) {
      byEmail.set(u.email.toLowerCase(), u);
    }
    // store wins on conflict — admin edits/creations override seeds
    for (const u of this.store) {
      byEmail.set(u.email.toLowerCase(), u);
    }
    return Array.from(byEmail.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  /** GET /api/users — paginated, filtered */
  findAll(filters: UsersFilter): UsersListResult {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    let results = this.mergedUsers();

    if (filters.role) {
      results = results.filter(
        (u) => u.role.toLowerCase() === filters.role!.toLowerCase(),
      );
    }
    if (filters.status === 'active') {
      results = results.filter((u) => u.isActive);
    } else if (filters.status === 'inactive') {
      results = results.filter((u) => !u.isActive);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.sapId ?? '').toLowerCase().includes(q),
      );
    }

    const total = results.length;
    const data = results
      .slice((page - 1) * limit, page * limit)
      .map((u) => this.safe(u));

    return { data, total, page, limit };
  }

  /** GET /api/users/me */
  findMe(userId: string): Omit<User, 'passwordHash'> {
    const user = this.store.find((u) => u.id === userId);
    if (!user) throw new NotFoundException('User not found');
    return this.safe(user);
  }

  /** GET /api/users/:id */
  findById(id: string): Omit<User, 'passwordHash'> {
    const user = this.store.find((u) => u.id === id);
    if (!user) throw new NotFoundException('User not found');
    return this.safe(user);
  }

  /** GET /api/users/by-email/:email */
  findByEmail(email: string): User | undefined {
    return this.store.find((u) => u.email === email);
  }

  /** POST /api/users */
  create(dto: CreateUserDto): Omit<User, 'passwordHash'> {
    if (this.store.find((u) => u.email === dto.email)) {
      throw new BadRequestException('Email already in use');
    }
    const user: User = {
      id: randomUUID(),
      name: dto.name,
      email: dto.email,
      passwordHash: bcrypt.hashSync(dto.password, 10),
      role: dto.role,
      institutionId: dto.institutionId,
      preferredLanguage: dto.preferredLanguage ?? 'en',
      sapId: dto.sapId,
      departmentCode: dto.departmentCode,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.push(user);
    return this.safe(user);
  }

  /** PATCH /api/users/:id */
  update(id: string, dto: UpdateUserDto): Omit<User, 'passwordHash'> {
    const idx = this.store.findIndex((u) => u.id === id);
    if (idx === -1) throw new NotFoundException('User not found');
    const user = this.store[idx]!;
    this.store[idx] = {
      ...user,
      ...(dto.name && { name: dto.name }),
      ...(dto.email && { email: dto.email }),
      ...(dto.sapId !== undefined && { sapId: dto.sapId }),
      ...(dto.departmentCode !== undefined && { departmentCode: dto.departmentCode }),
      ...(dto.preferredLanguage && { preferredLanguage: dto.preferredLanguage }),
      updatedAt: new Date().toISOString(),
    };
    return this.safe(this.store[idx]!);
  }

  /** PATCH /api/users/:id/status */
  setStatus(id: string, isActive: boolean): Omit<User, 'passwordHash'> {
    const idx = this.store.findIndex((u) => u.id === id);
    if (idx === -1) throw new NotFoundException('User not found');
    this.store[idx] = {
      ...this.store[idx]!,
      isActive,
      updatedAt: new Date().toISOString(),
    };
    return this.safe(this.store[idx]!);
  }

  /** POST /api/users/:id/reset-password — returns a temp password */
  resetPassword(id: string): { tempPassword: string } {
    const idx = this.store.findIndex((u) => u.id === id);
    if (idx === -1) throw new NotFoundException('User not found');
    const tempPassword = `Temp${Math.random().toString(36).slice(2, 8)}!`;
    this.store[idx] = {
      ...this.store[idx]!,
      passwordHash: bcrypt.hashSync(tempPassword, 10),
      updatedAt: new Date().toISOString(),
    };
    // Phase 2: send temp password via comms service (email/SMS)
    return { tempPassword };
  }

  /** GET /api/users/export — returns CSV string */
  exportCsv(): string {
    const header = 'id,name,email,role,sapId,departmentCode,isActive,createdAt';
    // Use the merged + deduped list so the CSV row count matches the
    // admin Users table (KAN-25).
    const rows = this.mergedUsers().map((u) =>
      [u.id, u.name, u.email, u.role, u.sapId ?? '', u.departmentCode ?? '', u.isActive, u.createdAt].join(','),
    );
    return [header, ...rows].join('\n');
  }
}
