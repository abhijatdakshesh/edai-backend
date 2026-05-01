import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'] ?? '';
    if (!auth.startsWith('Bearer ')) throw new UnauthorizedException('Missing Bearer token');

    const token = auth.slice(7);
    const secret = process.env['JWT_SECRET'];
    if (!secret) throw new Error('JWT_SECRET env var is not set');

    try {
      const payload = verify(token, secret);
      (req as Request & { user: unknown }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
