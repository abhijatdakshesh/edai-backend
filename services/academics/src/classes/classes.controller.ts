import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClassesService, CreateClassDto } from './classes.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../guards/roles.decorator';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /**
   * GET /api/classes?departmentCode=CSE&semester=6
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('departmentCode') departmentCode?: string,
    @Query('semester') semester?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.classesService.findAll({
      departmentCode,
      semester: semester ? parseInt(semester, 10) : undefined,
      academicYear,
    });
  }

  /** GET /api/classes/:id */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.classesService.findById(id);
  }

  /** GET /api/classes/:id/students */
  @Get(':id/students')
  @UseGuards(JwtAuthGuard)
  getStudents(@Param('id') id: string) {
    return this.classesService.getStudents(id);
  }

  /** POST /api/classes — admin/HOD creates a class */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL')
  create(@Body() dto: CreateClassDto) {
    return this.classesService.create(dto);
  }

  /** PATCH /api/classes/:id */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HOD')
  update(@Param('id') id: string, @Body() dto: Partial<CreateClassDto>) {
    return this.classesService.update(id, dto);
  }
}
