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
}
