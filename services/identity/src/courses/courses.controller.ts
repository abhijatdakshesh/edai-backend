import { Controller, Get, Post, Delete, Param, Request, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('courses')
  getCourses() {
    return this.coursesService.getCourses();
  }

  @Post('courses/:id/enroll')
  enroll(@Param('id') id: string, @Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.coursesService.enroll(id, usn);
  }

  @Delete('courses/:id/enroll')
  unenroll(@Param('id') id: string, @Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.coursesService.unenroll(id, usn);
  }

  @Get('academics/results/student/:usn')
  getResults(@Param('usn') usn: string) {
    return this.coursesService.getResults(usn);
  }

  @Get('courses/:id')
  getCourse(@Param('id') id: string) {
    return this.coursesService.getCourseById(id);
  }

  @Post('student/courses/:courseId/enroll')
  enrollStudent(@Param('courseId') id: string, @Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.coursesService.enroll(id, usn);
  }

  @Delete('student/courses/:courseId/enroll')
  unenrollStudent(@Param('courseId') id: string, @Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.coursesService.unenroll(id, usn);
  }

  @Get('student/courses')
  getStudentEnrollments(@Request() req: any): { courseIds: string[] } {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    const courseIds = this.coursesService.enrollments
      .filter((e) => e.studentUsn === usn)
      .map((e) => e.courseId);
    return { courseIds };
  }
}
