import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  DepartmentsService,
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './departments.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../guards/roles.decorator';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly deptService: DepartmentsService) {}

  /** GET /api/departments — all active departments */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.deptService.findAll();
  }

  /** GET /api/departments/:code — single dept detail */
  @Get(':code')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('code') code: string) {
    return this.deptService.findByCode(code);
  }

  /** POST /api/departments — create (admin only) */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateDepartmentDto) {
    return this.deptService.create(dto);
  }

  /** PATCH /api/departments/:code — update HOD or name */
  @Patch(':code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL')
  update(@Param('code') code: string, @Body() dto: UpdateDepartmentDto) {
    return this.deptService.update(code, dto);
  }
}
