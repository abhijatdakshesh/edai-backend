import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import {
  CreateUserDto,
  UpdateUserDto,
  SetUserStatusDto,
  UsersQueryDto,
} from '../dto/user.dto';
import type { User } from '../entities/user.entity';

interface AuthenticatedRequest {
  user: Omit<User, 'passwordHash'>;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users/me
   * Returns the current authenticated user's profile.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  /**
   * GET /api/users
   * Paginated, filterable user list.
   * Query: role, status (active|inactive), search, page, limit
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'TRUSTEE')
  findAll(@Query() q: UsersQueryDto) {
    return this.usersService.findAll({
      role: q.role,
      status: q.status,
      search: q.search,
      page: q.page ? parseInt(q.page, 10) : 1,
      limit: q.limit ? parseInt(q.limit, 10) : 20,
    });
  }

  /**
   * GET /api/users/export
   * Downloads a CSV of all users.
   */
  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  exportCsv(@Res() res: Response) {
    const csv = this.usersService.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(csv);
  }

  /**
   * GET /api/users/:id
   * Get a specific user's profile.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /**
   * POST /api/users
   * Create a new user. Admin only.
   * Body: CreateUserDto
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  /**
   * PATCH /api/users/:id
   * Update user profile fields.
   * Body: UpdateUserDto
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  /**
   * PATCH /api/users/:id/status
   * Activate or deactivate a user.
   * Body: { isActive: boolean }
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto) {
    return this.usersService.setStatus(id, dto.isActive);
  }

  /**
   * POST /api/users/:id/reset-password
   * Generates a temporary password and (Phase 2) emails it.
   * Returns: { tempPassword }
   */
  @Post(':id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }
}
