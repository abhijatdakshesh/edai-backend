import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DepartmentsService, type Department } from './departments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../roles/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly svc: DepartmentsService) {}

  @Get()
  findAll(): Department[] {
    return this.svc.findAll();
  }

  @Get(':code')
  findOne(@Param('code') code: string): Department {
    return this.svc.findByCode(code);
  }

  @Post()
  @Roles('ADMIN', 'PRINCIPAL')
  create(@Body() body: Omit<Department, 'active' | 'createdAt'>): Department {
    return this.svc.create(body);
  }

  @Patch(':code')
  @Roles('ADMIN', 'PRINCIPAL', 'HOD')
  update(@Param('code') code: string, @Body() body: Partial<Department>): Department {
    return this.svc.update(code, body);
  }
}
