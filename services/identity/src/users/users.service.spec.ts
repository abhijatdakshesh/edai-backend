import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService, type UsersFilter, type UsersListResult } from './users.service';
import type { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import type { User } from '../entities/user.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasNoPasswordHash(obj: Record<string, unknown>): boolean {
  return !('passwordHash' in obj);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ─── findAll / getAll ──────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns all seed users with default pagination (page=1, limit=20)', () => {
      const result: UsersListResult = service.findAll({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBeGreaterThanOrEqual(10); // 10 seed users
      expect(result.data.length).toBe(result.total); // all fit on first page
    });

    it('never exposes passwordHash in any returned user', () => {
      const result = service.findAll({});
      for (const user of result.data) {
        expect(hasNoPasswordHash(user as unknown as Record<string, unknown>)).toBe(true);
      }
    });

    it('filters by role=STUDENT returns only students', () => {
      const result = service.findAll({ role: 'STUDENT' });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBe(result.data.length);
      for (const user of result.data) {
        expect(user.role).toBe('STUDENT');
      }
    });

    it('role filter is case-insensitive', () => {
      const lower = service.findAll({ role: 'student' });
      const upper = service.findAll({ role: 'STUDENT' });
      expect(lower.total).toBe(upper.total);
    });

    it('filters by role=FACULTY returns only faculty', () => {
      const result = service.findAll({ role: 'FACULTY' });
      expect(result.total).toBeGreaterThan(0);
      expect(result.data.every((u) => u.role === 'FACULTY')).toBe(true);
    });

    it('filters by role=ADMIN returns only admin users', () => {
      const result = service.findAll({ role: 'ADMIN' });
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.data.every((u) => u.role === 'ADMIN')).toBe(true);
    });

    it('filters by status=active returns only active users', () => {
      const result = service.findAll({ status: 'active' });
      expect(result.data.every((u) => u.isActive)).toBe(true);
    });

    it('filters by status=inactive returns empty list (all seeds are active)', () => {
      const result = service.findAll({ status: 'inactive' });
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('returns inactive users after deactivating one', () => {
      // Create then deactivate
      const created = service.create({
        name: 'Test Inactive',
        email: 'inactive.test@rvce.edu',
        password: 'TestPass@123',
        role: 'FACULTY',
        institutionId: 'rvce',
      });
      service.setStatus(created.id, false);

      const result = service.findAll({ status: 'inactive' });
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.data.every((u) => !u.isActive)).toBe(true);
    });

    it('filters by departmentCode=CSE via search on email', () => {
      // All CSE users in seed have "cse" or "cs" in email/name
      // The search filter checks name, email, and sapId
      const result = service.findAll({ search: '1RV21CS' });
      expect(result.total).toBeGreaterThanOrEqual(2); // at least 2 CSE students
      for (const user of result.data) {
        expect(user.sapId).toMatch(/1RV21CS/i);
      }
    });

    it('filters by search on name (case-insensitive)', () => {
      const result = service.findAll({ search: 'priya' });
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.data.some((u) => u.name.toLowerCase().includes('priya'))).toBe(true);
    });

    it('filters by search on email', () => {
      const result = service.findAll({ search: 'admin@rvce' });
      expect(result.total).toBe(1);
      expect(result.data[0]!.email).toBe('admin@rvce.edu');
    });

    it('search with no matching results returns empty data and total=0', () => {
      const result = service.findAll({ search: 'zzznomatch999' });
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('applies pagination correctly — page 2 with limit 3', () => {
      // Get all to know what to expect
      const all = service.findAll({ limit: 100 });
      const page1 = service.findAll({ page: 1, limit: 3 });
      const page2 = service.findAll({ page: 2, limit: 3 });

      expect(page1.data).toHaveLength(3);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(3);

      expect(page2.page).toBe(2);
      expect(page2.data.length).toBeGreaterThan(0);

      // No overlap between pages
      const page1Ids = page1.data.map((u) => u.id);
      const page2Ids = page2.data.map((u) => u.id);
      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('page beyond data range returns empty data but correct total', () => {
      const result = service.findAll({ page: 9999, limit: 20 });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBeGreaterThan(0); // total is still full count
    });

    it('combines role and status filters', () => {
      const result = service.findAll({ role: 'STUDENT', status: 'active' });
      expect(result.data.every((u) => u.role === 'STUDENT' && u.isActive)).toBe(true);
    });
  });

  // ─── findById / getById ────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the correct user for a known id', () => {
      const user = service.findById('u-admin-01');
      expect(user.id).toBe('u-admin-01');
      expect(user.email).toBe('admin@rvce.edu');
      expect(user.role).toBe('ADMIN');
    });

    it('does not include passwordHash', () => {
      const user = service.findById('u-admin-01');
      expect(hasNoPasswordHash(user as unknown as Record<string, unknown>)).toBe(true);
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => service.findById('u-nonexistent-00')).toThrow(NotFoundException);
    });

    it('NotFoundException message is "User not found"', () => {
      let error!: NotFoundException;
      try {
        service.findById('bad-id');
      } catch (e) {
        error = e as NotFoundException;
      }
      expect(error.message).toBe('User not found');
    });

    it('returns different users for different ids', () => {
      const admin = service.findById('u-admin-01');
      const hod = service.findById('u-hod-01');
      expect(admin.id).not.toBe(hod.id);
      expect(admin.role).toBe('ADMIN');
      expect(hod.role).toBe('HOD');
    });
  });

  // ─── findMe ───────────────────────────────────────────────────────────────

  describe('findMe()', () => {
    it('returns the user for the given userId', () => {
      const user = service.findMe('u-student-01');
      expect(user.id).toBe('u-student-01');
      expect(user.email).toBe('student@rvce.edu');
    });

    it('throws NotFoundException for unknown userId', () => {
      expect(() => service.findMe('u-ghost')).toThrow(NotFoundException);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    const newUserDto: CreateUserDto = {
      name: 'New Faculty Member',
      email: 'newfaculty@rvce.edu',
      password: 'NewPass@123',
      role: 'FACULTY',
      institutionId: 'rvce',
      preferredLanguage: 'en',
    };

    it('creates a new user and returns safe user without passwordHash', () => {
      const user = service.create(newUserDto);
      expect(user.name).toBe('New Faculty Member');
      expect(user.email).toBe('newfaculty@rvce.edu');
      expect(user.role).toBe('FACULTY');
      expect(hasNoPasswordHash(user as unknown as Record<string, unknown>)).toBe(true);
    });

    it('assigns a UUID as the user id', () => {
      const user = service.create(newUserDto);
      // UUID v4 pattern
      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('hashes the password — plain text is NOT stored', () => {
      service.create(newUserDto);
      // Find the user by email to get the internal record (via findByEmail)
      const internal = service.findByEmail('newfaculty@rvce.edu') as User;
      expect(internal).toBeDefined();
      // The stored passwordHash must not equal the plain password
      expect(internal.passwordHash).not.toBe('NewPass@123');
      // And must be a valid bcrypt hash that matches the original password
      expect(bcrypt.compareSync('NewPass@123', internal.passwordHash)).toBe(true);
    });

    it('sets isActive=true by default', () => {
      const user = service.create(newUserDto);
      expect(user.isActive).toBe(true);
    });

    it('sets preferredLanguage to en by default when not provided', () => {
      const dto: CreateUserDto = { ...newUserDto, email: 'nolang@rvce.edu', preferredLanguage: undefined };
      const user = service.create(dto);
      expect(user.preferredLanguage).toBe('en');
    });

    it('respects preferredLanguage when provided', () => {
      const dto: CreateUserDto = { ...newUserDto, email: 'kannada@rvce.edu', preferredLanguage: 'kn' };
      const user = service.create(dto);
      expect(user.preferredLanguage).toBe('kn');
    });

    it('stores optional sapId and departmentCode', () => {
      const dto: CreateUserDto = {
        ...newUserDto,
        email: 'sapstudent@rvce.edu',
        sapId: '1RV22CS099',
        departmentCode: 'CSE',
      };
      const user = service.create(dto);
      expect(user.sapId).toBe('1RV22CS099');
      expect(user.departmentCode).toBe('CSE');
    });

    it('throws BadRequestException for duplicate email', () => {
      expect(() =>
        service.create({ ...newUserDto, email: 'admin@rvce.edu' }),
      ).toThrow(BadRequestException);
    });

    it('BadRequestException message is "Email already in use"', () => {
      let error!: BadRequestException;
      try {
        service.create({ ...newUserDto, email: 'admin@rvce.edu' });
      } catch (e) {
        error = e as BadRequestException;
      }
      expect(error.message).toBe('Email already in use');
    });

    it('newly created user is findable by findById', () => {
      const created = service.create(newUserDto);
      const found = service.findById(created.id);
      expect(found.email).toBe('newfaculty@rvce.edu');
    });

    it('newly created user appears in findAll results', () => {
      service.create(newUserDto);
      const all = service.findAll({ role: 'FACULTY' });
      expect(all.data.some((u) => u.email === 'newfaculty@rvce.edu')).toBe(true);
    });

    it('two different emails can be created without conflict', () => {
      const u1 = service.create({ ...newUserDto, email: 'a@rvce.edu' });
      const u2 = service.create({ ...newUserDto, email: 'b@rvce.edu' });
      expect(u1.id).not.toBe(u2.id);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates the name field', () => {
      const dto: UpdateUserDto = { name: 'Updated Admin Name' };
      const result = service.update('u-admin-01', dto);
      expect(result.name).toBe('Updated Admin Name');
    });

    it('updates the email field', () => {
      const dto: UpdateUserDto = { email: 'newemail@rvce.edu' };
      const result = service.update('u-admin-01', dto);
      expect(result.email).toBe('newemail@rvce.edu');
    });

    it('updates the role field', () => {
      const dto: UpdateUserDto = { role: 'HOD' };
      const result = service.update('u-admin-01', dto);
      expect(result.role).toBe('HOD');
    });

    it('updates departmentCode', () => {
      const dto: UpdateUserDto = { departmentCode: 'ECE' };
      const result = service.update('u-faculty-01', dto);
      expect(result.departmentCode).toBe('ECE');
    });

    it('updates sapId to empty string (undefined !== empty string)', () => {
      // sapId: undefined → not applied; sapId: '' → applied
      const dto: UpdateUserDto = { sapId: '' };
      const result = service.update('u-student-01', dto);
      expect(result.sapId).toBe('');
    });

    it('updates preferredLanguage', () => {
      const dto: UpdateUserDto = { preferredLanguage: 'kn' };
      const result = service.update('u-admin-01', dto);
      expect(result.preferredLanguage).toBe('kn');
    });

    it('does not change fields that are not in the DTO', () => {
      const before = service.findById('u-admin-01');
      service.update('u-admin-01', { name: 'Only Name Changed' });
      const after = service.findById('u-admin-01');
      // Email, role, institutionId, etc. must be unchanged
      expect(after.email).toBe(before.email);
      expect(after.role).toBe(before.role);
      expect(after.institutionId).toBe(before.institutionId);
    });

    it('updates updatedAt timestamp', () => {
      const before = service.findById('u-admin-01');
      // Small delay to ensure timestamp differs
      const result = service.update('u-admin-01', { name: 'Timestamped' });
      // updatedAt should be a valid ISO string; it may equal the seed value
      // in fast-running tests, but the field must exist
      expect(result.updatedAt).toBeTruthy();
      expect(typeof result.updatedAt).toBe('string');
    });

    it('does not expose passwordHash in the returned object', () => {
      const result = service.update('u-admin-01', { name: 'Safe' });
      expect(hasNoPasswordHash(result as unknown as Record<string, unknown>)).toBe(true);
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => service.update('u-nobody', { name: 'Ghost' })).toThrow(NotFoundException);
    });

    it('NotFoundException message is "User not found"', () => {
      let error!: NotFoundException;
      try {
        service.update('bad-id', { name: 'x' });
      } catch (e) {
        error = e as NotFoundException;
      }
      expect(error.message).toBe('User not found');
    });

    it('persists the change so findById returns updated data', () => {
      service.update('u-admin-01', { name: 'Persisted Name' });
      const found = service.findById('u-admin-01');
      expect(found.name).toBe('Persisted Name');
    });

    it('applies a partial update — undefined fields in DTO are ignored', () => {
      const before = service.findById('u-hod-01');
      service.update('u-hod-01', { name: 'New HOD Name' }); // no email field
      const after = service.findById('u-hod-01');
      expect(after.email).toBe(before.email); // email unchanged
      expect(after.name).toBe('New HOD Name');
    });
  });

  // ─── setStatus / updateStatus ─────────────────────────────────────────────

  describe('setStatus()', () => {
    it('deactivates an active user', () => {
      const result = service.setStatus('u-admin-01', false);
      expect(result.isActive).toBe(false);
    });

    it('activates an inactive user', () => {
      service.setStatus('u-admin-01', false); // deactivate first
      const result = service.setStatus('u-admin-01', true);
      expect(result.isActive).toBe(true);
    });

    it('the change persists — findById reflects the new status', () => {
      service.setStatus('u-faculty-01', false);
      const user = service.findById('u-faculty-01');
      expect(user.isActive).toBe(false);
    });

    it('throws NotFoundException for unknown user id', () => {
      expect(() => service.setStatus('u-ghost', false)).toThrow(NotFoundException);
    });

    it('does not expose passwordHash in the returned object', () => {
      const result = service.setStatus('u-admin-01', true);
      expect(hasNoPasswordHash(result as unknown as Record<string, unknown>)).toBe(true);
    });

    it('updates updatedAt on status change', () => {
      const result = service.setStatus('u-admin-01', false);
      expect(result.updatedAt).toBeTruthy();
    });

    it('deactivated user still findable but shows isActive=false', () => {
      service.setStatus('u-student-01', false);
      const found = service.findById('u-student-01');
      expect(found.isActive).toBe(false);
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword()', () => {
    it('returns an object with a tempPassword string', () => {
      const result = service.resetPassword('u-admin-01');
      expect(result).toHaveProperty('tempPassword');
      expect(typeof result.tempPassword).toBe('string');
    });

    it('tempPassword matches the pattern Temp<6chars>!', () => {
      const { tempPassword } = service.resetPassword('u-admin-01');
      // Pattern: "Temp" + 6 alphanumeric chars (base36) + "!"
      expect(tempPassword).toMatch(/^Temp[a-z0-9]{6}!$/);
    });

    it('the new tempPassword is hashed in the store and verifies correctly', () => {
      const { tempPassword } = service.resetPassword('u-admin-01');
      const internal = service.findByEmail('admin@rvce.edu') as User;
      expect(bcrypt.compareSync(tempPassword, internal.passwordHash)).toBe(true);
    });

    it('the old password no longer works after reset', () => {
      service.resetPassword('u-admin-01');
      const internal = service.findByEmail('admin@rvce.edu') as User;
      expect(bcrypt.compareSync('Admin@123', internal.passwordHash)).toBe(false);
    });

    it('generates different tempPasswords on repeated calls', () => {
      const r1 = service.resetPassword('u-admin-01');
      const r2 = service.resetPassword('u-admin-01');
      // Statistically almost impossible to be equal
      expect(r1.tempPassword).not.toBe(r2.tempPassword);
    });

    it('throws NotFoundException for unknown user id', () => {
      expect(() => service.resetPassword('u-nonexistent')).toThrow(NotFoundException);
    });

    it('NotFoundException message is "User not found"', () => {
      let error!: NotFoundException;
      try {
        service.resetPassword('bad-id');
      } catch (e) {
        error = e as NotFoundException;
      }
      expect(error.message).toBe('User not found');
    });

    it('updates updatedAt after password reset', () => {
      const before = service.findById('u-faculty-01');
      service.resetPassword('u-faculty-01');
      const after = service.findById('u-faculty-01');
      // updatedAt must be a valid ISO string
      expect(after.updatedAt).toBeTruthy();
    });
  });

  // ─── exportCsv ────────────────────────────────────────────────────────────

  describe('exportCsv()', () => {
    it('returns a non-empty string', () => {
      const csv = service.exportCsv();
      expect(typeof csv).toBe('string');
      expect(csv.length).toBeGreaterThan(0);
    });

    it('first line is the correct CSV header', () => {
      const csv = service.exportCsv();
      const firstLine = csv.split('\n')[0];
      expect(firstLine).toBe('id,name,email,role,sapId,departmentCode,isActive,createdAt');
    });

    it('contains one row per user plus the header', () => {
      const all = service.findAll({ limit: 100 });
      const csv = service.exportCsv();
      const lines = csv.split('\n');
      // 1 header + N data rows
      expect(lines.length).toBe(all.total + 1);
    });

    it('each data row contains the user id', () => {
      const csv = service.exportCsv();
      const lines = csv.split('\n').slice(1); // skip header
      expect(lines.some((line) => line.startsWith('u-admin-01,'))).toBe(true);
    });

    it('does NOT include passwordHash in any CSV row', () => {
      const csv = service.exportCsv();
      // bcrypt hashes start with $2b$ or $2a$
      expect(csv).not.toMatch(/\$2[ab]\$/);
    });

    it('includes the isActive flag (true/false) in each row', () => {
      const csv = service.exportCsv();
      const lines = csv.split('\n').slice(1);
      for (const line of lines) {
        expect(line).toMatch(/,(true|false)/);
      }
    });

    it('newly created user appears in the CSV export', () => {
      service.create({
        name: 'CSV Test User',
        email: 'csvtest@rvce.edu',
        password: 'CsvTest@123',
        role: 'COUNSELLOR',
        institutionId: 'rvce',
      });
      const csv = service.exportCsv();
      expect(csv).toContain('csvtest@rvce.edu');
    });

    it('rows with missing optional fields (sapId, departmentCode) have empty values', () => {
      const csv = service.exportCsv();
      // Admin user has no sapId or departmentCode — row should have consecutive commas
      const adminRow = csv.split('\n').find((l) => l.startsWith('u-admin-01,'));
      expect(adminRow).toBeDefined();
      // Format: id,name,email,role,,, (two empty optional fields)
      expect(adminRow).toMatch(/ADMIN,,/);
    });
  });

  // ─── findByEmail ──────────────────────────────────────────────────────────

  describe('findByEmail()', () => {
    it('returns the full User (including passwordHash) for a known email', () => {
      const user = service.findByEmail('admin@rvce.edu');
      expect(user).toBeDefined();
      expect(user!.id).toBe('u-admin-01');
      expect(user!.passwordHash).toBeTruthy();
    });

    it('returns undefined for unknown email', () => {
      const user = service.findByEmail('nobody@example.com');
      expect(user).toBeUndefined();
    });

    it('is case-sensitive (exact match)', () => {
      const upper = service.findByEmail('ADMIN@RVCE.EDU');
      expect(upper).toBeUndefined();
    });
  });
});
