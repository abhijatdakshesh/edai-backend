import { Controller, Get, Headers, Param } from '@nestjs/common';
import { StudentsService } from './students.service';
import type { Student } from '../entities/student.entity';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get(':id')
  findById(
    @Param('id') id: string,
    @Headers('x-user-id') requesterId = 's-1',
  ): Student {
    return this.studentsService.findById(id, requesterId);
  }
}
