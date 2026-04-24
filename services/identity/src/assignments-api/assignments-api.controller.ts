import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AssignmentsApiService } from './assignments-api.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsGateway } from '../events/events.gateway';

@UseGuards(JwtAuthGuard)
@Controller()
export class AssignmentsApiController {
  constructor(
    private readonly svc: AssignmentsApiService,
    private readonly events: EventsGateway,
  ) {}

  @Get('student/assignments')
  getStudentAssignments(@Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getStudentAssignments(usn);
  }

  @Get('teacher/assignments')
  getTeacherAssignments(@Request() req: any) {
    const teacherId = req.user?.sub ?? 'unknown';
    return this.svc.getTeacherAssignments(teacherId);
  }

  @Post('teacher/assignments')
  createAssignment(
    @Body()
    body: {
      title: string;
      dueDate: string;
      subjectCode: string;
      description: string;
      maxMarks: number;
    },
    @Request() req: any,
  ) {
    const teacherId = req.user?.sub ?? 'unknown';
    return this.svc.createAssignment(body, teacherId);
  }

  @Patch('teacher/assignments/:id/publish')
  publishAssignment(@Param('id') id: string) {
    return this.svc.publishAssignment(id);
  }

  @Get('teacher/assignments/:id/submissions')
  getSubmissions(@Param('id') id: string) {
    return this.svc.getSubmissions(id);
  }

  @Post('teacher/assignments/:id/submissions/:usn/grade')
  gradeSubmission(
    @Param('id') id: string,
    @Param('usn') usn: string,
    @Body() body: { marks: number; feedback: string },
  ) {
    const result = this.svc.gradeSubmission(id, usn, body.marks, body.feedback);
    this.events.emitMarksUpdate({ subjectCode: result.assignmentId, sem: 0 });
    return result;
  }

  // Base assignments - static routes BEFORE param routes to avoid conflicts
  @Get('assignments')
  getAllAssignments() {
    return this.svc.getAllAssignments();
  }

  @Get('assignments/course/:courseId')
  getAssignmentsByCourse(@Param('courseId') courseId: string) {
    return this.svc.getAssignmentsByCourse(courseId);
  }

  @Get('assignments/student/:usn')
  getStudentAssignmentsByUsn(@Param('usn') usn: string) {
    return this.svc.getStudentAssignments(usn);
  }

  @Get('teacher/assignments/:id')
  getAssignmentDetail(@Param('id') id: string) {
    return this.svc.getAssignmentById(id);
  }

  @Get('assignments/:id/submissions')
  getSubmissionsById(@Param('id') id: string) {
    return this.svc.getSubmissions(id);
  }

  @Post('assignments/:id/submit')
  submitAssignment(
    @Param('id') id: string,
    @Body() body: { fileUrl?: string; text?: string },
    @Request() req: any,
  ) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.submitAssignment(id, usn, body);
  }

  @Post('assignments/submissions/:submissionId/grade')
  gradeSubmissionById(
    @Param('submissionId') subId: string,
    @Body() body: { marks: number; feedback: string },
  ) {
    return this.svc.gradeSubmissionById(subId, body.marks, body.feedback);
  }
}
