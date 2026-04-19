import type { UserRole } from '../entities/user.entity';
interface RoleDefinition {
    name: UserRole;
    permissions: string[];
}
export declare class RolesService {
    private readonly roles;
    findAll(): RoleDefinition[];
    findByName(name: UserRole): RoleDefinition | undefined;
    hasPermission(role: UserRole, permission: string): boolean;
}
export {};
