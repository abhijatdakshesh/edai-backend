import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { StudentPortalService } from './student-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class StudentPortalController {
  constructor(private readonly svc: StudentPortalService) {}

  @Get('student/dashboard')
  getDashboard(@Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getDashboard(usn);
  }

  @Get('student/schedule')
  getSchedule(@Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getSchedule(usn);
  }

  @Get('student/hostel')
  getHostel(@Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getHostel(usn);
  }

  @Get('student/exam-prep')
  getExamPrep(@Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getExamPrep(usn);
  }

  @Get('student/hr')
  getStaff() {
    return this.svc.getStaff();
  }

  @Get('institution/staff')
  getInstitutionStaff() {
    return this.svc.getStaff();
  }
}
