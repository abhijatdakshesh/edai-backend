import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService, type UsersListResult } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { CreateUserDto, UpdateUserDto, SetUserStatusDto, UsersQueryDto } from '../dto/user.dto';
import type { User } from '../entities/user.entity';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const adminUser: Omit<User, 'passwordHash'> = {
  id: 'u-admin-01',
  name: 'Admin User',
  email: 'admin@rvce.edu',
  role: 'ADMIN',
  institutionId: 'rvce',
  preferredLanguage: 'en',
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const studentUser: Omit<User, 'passwordHash'> = {
  id: 'u-student-01',
  name: 'Arjun Kumar',
  email: 'student@rvce.edu',
  role: 'STUDENT',
  institutionId: 'rvce',
  sapId: '1RV21CS001',
  preferredLanguage: 'en',
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockListResult: UsersListResult = {
  data: [adminUser, studentUser],
  total: 2,
  page: 1,
  limit: 20,
};

// ─── Mock UsersService ────────────────────────────────────────────────────────

const mockUsersService = {
  findAll: jest.fn(),
  findMe: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  setStatus: jest.fn(),
  resetPassword: jest.fn(),
  exportCsv: jest.fn(),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  // ─── me() ───────────────────────────────────────────────────────────────────

  describe('me()', () => {
    it('returns req.user without calling usersService', () => {
      const req = { user: adminUser } as unknown as Parameters<typeof controller.me>[0];
      const result = controller.me(req);
      expect(result).toBe(adminUser);
      expect(mockUsersService.findAll).not.toHaveBeenCalled();
    });

    it('returns the exact user object attached to the request', () => {
      const req = { user: studentUser } as unknown as Parameters<typeof controller.me>[0];
      const result = controller.me(req);
      expect(result.id).toBe('u-student-01');
      expect(result.role).toBe('STUDENT');
    });
  });

  // ─── findAll() ──────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('delegates to usersService.findAll with default pagination when no query params', () => {
      mockUsersService.findAll.mockReturnValueOnce(mockListResult);

      const query: UsersQueryDto = {};
      const result = controller.findAll(query);

      expect(mockUsersService.findAll).toHaveBeenCalledTimes(1);
      expect(mockUsersService.findAll).toHaveBeenCalledWith({
        role: undefined,
        status: undefined,
        search: undefined,
        page: 1,
        limit: 20,
      });
      expect(result).toBe(mockListResult);
    });

    it('parses page and limit strings to integers', () => {
      mockUsersService.findAll.mockReturnValueOnce(mockListResult);

      controller.findAll({ page: '3', limit: '5' });

      expect(mockUsersService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, limit: 5 }),
      );
    });

    it('passes role filter through to the service', () => {
      mockUsersService.findAll.mockReturnValueOnce(mockListResult);

      controller.findAll({ role: 'STUDENT' });

      expect(mockUsersService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'STUDENT' }),
      );
    });

    it('passes status filter through to the service', () => {
      mockUsersService.findAll.mockReturnValueOnce(mockListResult);

      controller.findAll({ status: 'inactive' });

      expect(mockUsersService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'inactive' }),
      );
    });

    it('passes search filter through to the service', () => {
      mockUsersService.findAll.mockReturnValueOnce(mockListResult);

      controller.findAll({ search: 'arjun' });

      expect(mockUsersService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'arjun' }),
      );
    });

    it('returns the service result unchanged', () => {
      mockUsersService.findAll.mockReturnValueOnce(mockListResult);
      const result = controller.findAll({});
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('defaults page to 1 when page query param is absent', () => {
      mockUsersService.findAll.mockReturnValueOnce(mockListResult);
      controller.findAll({});
      expect(mockUsersService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });

    it('defaults limit to 20 when limit query param is absent', () => {
      mockUsersService.findAll.mockReturnValueOnce(mockListResult);
      controller.findAll({});
      expect(mockUsersService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20 }),
      );
    });
  });

  // ─── exportCsv() ────────────────────────────────────────────────────────────

  describe('exportCsv()', () => {
    it('delegates to usersService.exportCsv and sends the result', () => {
      const csvContent = 'id,name,email\nu-admin-01,Admin User,admin@rvce.edu';
      mockUsersService.exportCsv.mockReturnValueOnce(csvContent);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      controller.exportCsv(mockRes);

      expect(mockUsersService.exportCsv).toHaveBeenCalledTimes(1);
      expect(mockRes.send).toHaveBeenCalledWith(csvContent);
    });

    it('sets Content-Type header to text/csv', () => {
      mockUsersService.exportCsv.mockReturnValueOnce('csv-data');
      const mockRes = { setHeader: jest.fn(), send: jest.fn() } as unknown as Response;

      controller.exportCsv(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    });

    it('sets Content-Disposition header for file download', () => {
      mockUsersService.exportCsv.mockReturnValueOnce('csv-data');
      const mockRes = { setHeader: jest.fn(), send: jest.fn() } as unknown as Response;

      controller.exportCsv(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="users.csv"',
      );
    });
  });

  // ─── findOne() ──────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('delegates to usersService.findById with the route param id', () => {
      mockUsersService.findById.mockReturnValueOnce(adminUser);

      const result = controller.findOne('u-admin-01');

      expect(mockUsersService.findById).toHaveBeenCalledWith('u-admin-01');
      expect(result).toBe(adminUser);
    });

    it('returns the user returned by the service', () => {
      mockUsersService.findById.mockReturnValueOnce(studentUser);
      const result = controller.findOne('u-student-01');
      expect(result.email).toBe('student@rvce.edu');
    });

    it('propagates NotFoundException from usersService.findById', () => {
      mockUsersService.findById.mockImplementationOnce(() => {
        throw new NotFoundException('User not found');
      });
      expect(() => controller.findOne('u-ghost')).toThrow(NotFoundException);
    });
  });

  // ─── create() ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    const createDto: CreateUserDto = {
      name: 'New Teacher',
      email: 'newteacher@rvce.edu',
      password: 'Teacher@456',
      role: 'FACULTY',
      institutionId: 'rvce',
    };

    it('delegates to usersService.create with the DTO', () => {
      mockUsersService.create.mockReturnValueOnce({ ...adminUser, id: 'u-new-01' });
      controller.create(createDto);
      expect(mockUsersService.create).toHaveBeenCalledWith(createDto);
    });

    it('returns the created user from the service', () => {
      const newUser = { ...adminUser, id: 'u-new-01', email: 'newteacher@rvce.edu' };
      mockUsersService.create.mockReturnValueOnce(newUser);
      const result = controller.create(createDto);
      expect(result).toBe(newUser);
    });

    it('propagates BadRequestException for duplicate email', () => {
      mockUsersService.create.mockImplementationOnce(() => {
        throw new BadRequestException('Email already in use');
      });
      expect(() => controller.create(createDto)).toThrow(BadRequestException);
    });
  });

  // ─── update() ───────────────────────────────────────────────────────────────

  describe('update()', () => {
    const updateDto: UpdateUserDto = { name: 'Updated Name' };

    it('delegates to usersService.update with id and DTO', () => {
      mockUsersService.update.mockReturnValueOnce(adminUser);
      controller.update('u-admin-01', updateDto);
      expect(mockUsersService.update).toHaveBeenCalledWith('u-admin-01', updateDto);
    });

    it('returns the updated user from the service', () => {
      const updated = { ...adminUser, name: 'Updated Name' };
      mockUsersService.update.mockReturnValueOnce(updated);
      const result = controller.update('u-admin-01', updateDto);
      expect(result.name).toBe('Updated Name');
    });

    it('propagates NotFoundException for unknown id', () => {
      mockUsersService.update.mockImplementationOnce(() => {
        throw new NotFoundException('User not found');
      });
      expect(() => controller.update('u-ghost', updateDto)).toThrow(NotFoundException);
    });


  });

  // ─── setStatus() ────────────────────────────────────────────────────────────

  describe('setStatus()', () => {
    it('delegates to usersService.setStatus with id and isActive value', () => {
      const deactivated = { ...adminUser, isActive: false };
      mockUsersService.setStatus.mockReturnValueOnce(deactivated);

      const dto: SetUserStatusDto = { isActive: false };
      controller.setStatus('u-admin-01', dto);

      expect(mockUsersService.setStatus).toHaveBeenCalledWith('u-admin-01', false);
    });

    it('returns the updated user with new status', () => {
      const activated = { ...adminUser, isActive: true };
      mockUsersService.setStatus.mockReturnValueOnce(activated);
      const result = controller.setStatus('u-admin-01', { isActive: true });
      expect(result.isActive).toBe(true);
    });

    it('propagates NotFoundException from usersService.setStatus', () => {
      mockUsersService.setStatus.mockImplementationOnce(() => {
        throw new NotFoundException('User not found');
      });
      expect(() => controller.setStatus('u-ghost', { isActive: false })).toThrow(
        NotFoundException,
      );
    });

    it('passes isActive=false to deactivate a user', () => {
      mockUsersService.setStatus.mockReturnValueOnce({ ...adminUser, isActive: false });
      controller.setStatus('u-admin-01', { isActive: false });
      expect(mockUsersService.setStatus).toHaveBeenCalledWith('u-admin-01', false);
    });

    it('passes isActive=true to activate a user', () => {
      mockUsersService.setStatus.mockReturnValueOnce({ ...adminUser, isActive: true });
      controller.setStatus('u-admin-01', { isActive: true });
      expect(mockUsersService.setStatus).toHaveBeenCalledWith('u-admin-01', true);
    });
  });

  // ─── resetPassword() ────────────────────────────────────────────────────────

  describe('resetPassword()', () => {
    it('delegates to usersService.resetPassword with the user id', () => {
      mockUsersService.resetPassword.mockReturnValueOnce({ tempPassword: 'TempAbc123!' });
      controller.resetPassword('u-admin-01');
      expect(mockUsersService.resetPassword).toHaveBeenCalledWith('u-admin-01');
    });

    it('returns the tempPassword object from the service', () => {
      mockUsersService.resetPassword.mockReturnValueOnce({ tempPassword: 'TempXyz456!' });
      const result = controller.resetPassword('u-admin-01');
      expect(result).toEqual({ tempPassword: 'TempXyz456!' });
    });

    it('propagates NotFoundException for unknown user id', () => {
      mockUsersService.resetPassword.mockImplementationOnce(() => {
        throw new NotFoundException('User not found');
      });
      expect(() => controller.resetPassword('u-ghost')).toThrow(NotFoundException);
    });
  });
});
