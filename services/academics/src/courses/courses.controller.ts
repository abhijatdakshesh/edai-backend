import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoursesService, CreateCourseDto } from './courses.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../guards/roles.decorator';
import type { CourseType } from '../entities/academics.entity';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  /**
   * GET /api/courses?departmentCode=CSE&semester=6&type=THEORY&search=ML
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('departmentCode') departmentCode?: string,
    @Query('semester') semester?: string,
    @Query('type') type?: CourseType,
    @Query('search') search?: string,
  ) {
    return this.coursesService.findAll({
      departmentCode,
      semester: semester ? parseInt(semester, 10) : undefined,
      type,
      search,
    });
  }

  /** GET /api/courses/:id */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.coursesService.findById(id);
  }

  /** POST /api/courses */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HOD')
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  /** PATCH /api/courses/:id */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HOD')
  update(@Param('id') id: string, @Body() dto: Partial<CreateCourseDto>) {
    return this.coursesService.update(id, dto);
  }

  /** DELETE /api/courses/:id — soft delete (deactivate) */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  deactivate(@Param('id') id: string) {
    return this.coursesService.deactivate(id);
  }
}
