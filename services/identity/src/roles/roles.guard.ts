import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { UserRole } from '../entities/user.entity';

interface RequestWithUser {
  headers: Record<string, string | undefined>;
  user?: { role: UserRole };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator → route is publicly accessible (auth still checked by JwtAuthGuard if applied)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // request.user is populated by JwtStrategy when JwtAuthGuard runs first.
    // Dev convenience: accept x-role header when testing without a real JWT.
    const role: UserRole | undefined =
      request.user?.role ?? (request.headers['x-role'] as UserRole | undefined);

    // No user yet means JwtAuthGuard hasn't run — pass through so JwtAuthGuard returns 401.
    // Role check only applies to authenticated requests.
    if (!role) return true;
    return requiredRoles.includes(role);
  }
}
