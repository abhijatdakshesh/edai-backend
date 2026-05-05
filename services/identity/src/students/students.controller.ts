import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
  @UseGuards(JwtAuthGuard)
  @Get(':usn/contact')
  async findContactByUsn(@Param('usn') usn: string): Promise<ContactInfo> {
    return this.studentsService.findContactByUsn(usn);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Student> {
    const jwtUser = (req as unknown as { user?: { userId: string } }).user;
    const requesterId = jwtUser?.userId ?? id;
    return this.studentsService.findById(id, requesterId);
  }
}
