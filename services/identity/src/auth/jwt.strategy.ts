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
      secretOrKey: (() => {
        const secret = process.env['JWT_SECRET'];
        if (!secret) throw new Error('JWT_SECRET env var is required — set it before starting the server');
        return secret;
      })(),
    });
  }

  validate(payload: JwtPayload) {
    const user = this.authService.validatePayload(payload);
    if (!user) throw new UnauthorizedException('Token invalid or user inactive');
    // Attach sub from the JWT payload so controllers that destructure { sub } work consistently with WS gateway.
    return { ...user, sub: payload.sub }; // attached to request.user
  }
}
