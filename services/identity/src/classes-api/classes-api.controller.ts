import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ClassesApiService } from './classes-api.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class ClassesApiController {
  constructor(private readonly svc: ClassesApiService) {}

  @Get('teacher/classes')
  getTeacherClasses(@Request() req: any) {
    const teacherId = req.user?.sub ?? 'unknown';
    return this.svc.getTeacherClasses(teacherId);
  }

  @Get('teacher/dashboard')
  getTeacherDashboard(@Request() req: any) {
    const teacherId = req.user?.sub ?? 'unknown';
    return this.svc.getTeacherDashboard(teacherId);
  }

  @Get('classes')
  getAllClasses() {
    return this.svc.getAllClasses();
  }
}
