import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, type JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'] ?? 'edai-dev-secret-change-in-production',
    });
  }

  validate(payload: JwtPayload) {
    const user = this.authService.validatePayload(payload);
    if (!user) throw new UnauthorizedException('Token invalid or user inactive');
    return user; // attached to request.user
  }
}
