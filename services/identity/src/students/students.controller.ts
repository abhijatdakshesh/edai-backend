import { Controller, Get, Headers, Param } from '@nestjs/common';
import { StudentsService } from './students.service';
import type { Student } from '../entities/student.entity';

interface ContactInfo {
  parentPhone: string;
  parentName: string;
  preferredLanguage: string;
  consentVoice: boolean;
}

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  // Must be declared before :id to avoid NestJS swallowing "contact" as an id value.
  @Get(':usn/contact')
  findContactByUsn(@Param('usn') usn: string): ContactInfo {
    return this.studentsService.findContactByUsn(usn);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @Headers('x-user-id') requesterId = 's-1',
  ): Student {
    return this.studentsService.findById(id, requesterId);
  }
}
