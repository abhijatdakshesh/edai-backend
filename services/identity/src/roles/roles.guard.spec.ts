import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';
import type { UserRole } from '../entities/user.entity';

function buildContext(options: {
  requiredRoles?: UserRole[];
  userRole?: UserRole;
  headerRole?: string;
}): ExecutionContext {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(options.requiredRoles ?? []),
  } as unknown as Reflector;

  const request: any = {
    user: options.userRole ? { role: options.userRole } : undefined,
    headers: options.headerRole ? { 'x-role': options.headerRole } : {},
  };

  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
    // keep a handle on the reflector so tests can swap values
    __reflector: reflector,
  } as any;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard({
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector);
  });

  it('allows access when no roles are required (no decorator)', () => {
    // Provide a real Reflector that returns no required roles
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([]) } as unknown as Reflector;
    guard = new RolesGuard(reflector);

    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: undefined, headers: {} }) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when no decorator is present (undefined roles)', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    guard = new RolesGuard(reflector);

    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: undefined, headers: {} }) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when user role matches required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN'] as UserRole[]),
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);

    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'ADMIN' }, headers: {} }) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies access when user role does not match required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN'] as UserRole[]),
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);

    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'STUDENT' }, headers: {} }) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('falls back to x-role header when request.user is absent', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['HOD'] as UserRole[]),
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);

    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: undefined, headers: { 'x-role': 'HOD' } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies access when neither user nor x-role header is present', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN'] as UserRole[]),
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);

    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: undefined, headers: {} }) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('allows access when one of multiple required roles matches', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN', 'PRINCIPAL'] as UserRole[]),
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);

    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'PRINCIPAL' }, headers: {} }) }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
