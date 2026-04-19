import type { User } from '../entities/user.entity';
import type { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
export interface UsersListResult {
    data: Omit<User, 'passwordHash'>[];
    total: number;
    page: number;
    limit: number;
}
export interface UsersFilter {
    role?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
}
export declare class UsersService {
    private readonly store;
    private seed;
    private safe;
    findAll(filters: UsersFilter): UsersListResult;
    findMe(userId: string): Omit<User, 'passwordHash'>;
    findById(id: string): Omit<User, 'passwordHash'>;
    findByEmail(email: string): User | undefined;
    create(dto: CreateUserDto): Omit<User, 'passwordHash'>;
    update(id: string, dto: UpdateUserDto): Omit<User, 'passwordHash'>;
    setStatus(id: string, isActive: boolean): Omit<User, 'passwordHash'>;
    resetPassword(id: string): {
        tempPassword: string;
    };
    exportCsv(): string;
}
