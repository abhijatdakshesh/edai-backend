import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, LogoutDto } from '../dto/auth.dto';
import type { User } from '../entities/user.entity';
interface AuthenticatedRequest extends Request {
    user: Omit<User, 'passwordHash'>;
}
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): Promise<import("./auth.service").LoginResponse>;
    refresh(dto: RefreshDto): Pick<import("./auth.service").TokenPair, "accessToken" | "expiresIn">;
    logout(dto: LogoutDto): {
        ok: boolean;
    };
    me(req: AuthenticatedRequest): Omit<User, 'passwordHash'>;
    keycloakCallback(): {
        status: string;
    };
}
export {};
