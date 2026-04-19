import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../entities/user.entity';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: UserRole[]) => ReturnType<typeof SetMetadata>;
