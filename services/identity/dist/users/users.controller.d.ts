import type { Response } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, SetUserStatusDto, UsersQueryDto } from '../dto/user.dto';
import type { User } from '../entities/user.entity';
interface AuthenticatedRequest {
    user: Omit<User, 'passwordHash'>;
}
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    me(req: AuthenticatedRequest): Omit<User, "passwordHash">;
    findAll(q: UsersQueryDto): import("./users.service").UsersListResult;
    exportCsv(res: Response): void;
    findOne(id: string): Omit<User, "passwordHash">;
    create(dto: CreateUserDto): Omit<User, "passwordHash">;
    update(id: string, dto: UpdateUserDto): Omit<User, "passwordHash">;
    setStatus(id: string, dto: SetUserStatusDto): Omit<User, "passwordHash">;
    resetPassword(id: string): {
        tempPassword: string;
    };
}
export {};
