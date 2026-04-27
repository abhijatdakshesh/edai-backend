import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';

/** Decorator that marks which roles can access a route. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Phase 1 guard: reads x-user-role header injected by the Nginx API gateway.
 * Phase 2: replace with full JwtAuthGuard from shared-auth package.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required: string[] | undefined = this.reflector.getAllAndOverride(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const role = req.headers['x-user-role'];
    if (!role) throw new UnauthorizedException('x-user-role header missing');
    if (!required.includes(role)) throw new ForbiddenException(`Role ${role} is not permitted`);
    return true;
  }
}
