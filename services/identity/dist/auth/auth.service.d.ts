import { JwtService } from '@nestjs/jwt';
import type { User } from '../entities/user.entity';
export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    institutionId: string;
    preferredLanguage: string;
    iat?: number;
    exp?: number;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface LoginResponse extends TokenPair {
    user: Omit<User, 'passwordHash'>;
}
export declare class AuthService {
    private readonly jwtService;
    private readonly users;
    private readonly refreshStore;
    constructor(jwtService: JwtService);
    login(email: string, password: string): Promise<LoginResponse>;
    refresh(incomingRefreshToken: string): Pick<TokenPair, 'accessToken' | 'expiresIn'>;
    logout(refreshToken: string): {
        ok: boolean;
    };
    validatePayload(payload: JwtPayload): Omit<User, 'passwordHash'> | null;
    private issueTokens;
}
