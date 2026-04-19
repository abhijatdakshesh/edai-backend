import { Strategy } from 'passport-jwt';
import { AuthService, type JwtPayload } from './auth.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly authService;
    constructor(authService: AuthService);
    validate(payload: JwtPayload): Omit<import("../entities/user.entity").User, "passwordHash">;
}
export {};
