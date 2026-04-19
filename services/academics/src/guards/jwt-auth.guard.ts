/**
 * Lightweight JWT guard for the academics service.
 *
 * In production: use passport-jwt strategy (same secret as identity service)
 * OR validate token via a shared auth library / API gateway.
 *
 * For development: accepts any request with an Authorization header
 * OR an x-user-id header (dev convenience).
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

interface IncomingRequest {
  headers: Record<string, string | undefined>;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<IncomingRequest>();
    // Allow if Bearer token OR dev x-user-id header is present
    return !!(
      req.headers['authorization'] || req.headers['x-user-id']
    );
  }
}
