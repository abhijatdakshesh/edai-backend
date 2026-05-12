import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsBoolean,
} from 'class-validator';
import type { Language, UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(['STUDENT', 'PARENT', 'FACULTY', 'HOD', 'DEAN', 'PRINCIPAL', 'TRUSTEE', 'COUNSELLOR', 'ADMIN'])
  role!: UserRole;

  @IsString()
  institutionId!: string;

  @IsOptional()
  @IsString()
  sapId?: string;

  @IsOptional()
  @IsString()
  departmentCode?: string;

  @IsOptional()
  @IsEnum(['kn', 'en', 'hi', 'ta', 'te', 'ml'])
  preferredLanguage?: Language;

  /**
   * KAN-26: required when role=PARENT. The admin must pick which student
   * this parent is linked to; the backend never auto-picks. Validation that
   * this is non-empty for PARENT lives in UsersService.create() so we can
   * surface a friendly BadRequest instead of a generic class-validator error.
   */
  @IsOptional()
  @IsString()
  parentStudentUsn?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // role intentionally omitted — privilege escalation prevention; use dedicated admin endpoint

  @IsOptional()
  @IsString()
  sapId?: string;

  @IsOptional()
  @IsString()
  departmentCode?: string;

  @IsOptional()
  @IsEnum(['kn', 'en', 'hi', 'ta', 'te', 'ml'])
  preferredLanguage?: Language;
}

export class SetUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UsersQueryDto {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  status?: string; // 'active' | 'inactive'

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
