import type { Language, UserRole } from '../entities/user.entity';
export declare class CreateUserDto {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    institutionId: string;
    sapId?: string;
    departmentCode?: string;
    preferredLanguage?: Language;
}
export declare class UpdateUserDto {
    name?: string;
    email?: string;
    role?: UserRole;
    sapId?: string;
    departmentCode?: string;
    preferredLanguage?: Language;
}
export declare class SetUserStatusDto {
    isActive: boolean;
}
export declare class UsersQueryDto {
    role?: string;
    status?: string;
    search?: string;
    page?: string;
    limit?: string;
}
