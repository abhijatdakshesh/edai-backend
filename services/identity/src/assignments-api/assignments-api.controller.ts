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
    const subjectName: Record<string, string> = {
      CS501: 'Database Management Systems', CS502: 'Database Management Systems',
      CS503: 'Computer Networks', CS504: 'Operating Systems',
      CS505: 'Design & Analysis of Algorithms', CS506: 'Machine Learning',
      CS507: 'Microprocessors & Embedded Systems',
    };
    return this.svc.getTeacherAssignments(teacherId).map((a) => ({
      id: a.id,
      title: a.title,
      courseCode: a.subjectCode,
      courseName: subjectName[a.subjectCode] ?? a.subjectCode,
      classId: `class-${(a.subjectCode || 'cs').toLowerCase()}-a`,
      className: `${a.subjectCode} - Section A`,
      dueDate: a.dueDate,
      maxMarks: a.maxMarks,
      status: a.status,
      submissionCount: a.submissionCount ?? 0,
      totalStudents: 60,
      createdAt: a.dueDate,
    }));
  }

  @Post('teacher/assignments')
  createAssignment(
    @Body()
    body: {
      title: string;
      dueDate: string;
      // Frontend sends courseCode; legacy clients may send subjectCode
      courseCode?: string;
      subjectCode?: string;
      classId?: string;
      description?: string;
      maxMarks: number;
      status?: 'DRAFT' | 'PUBLISHED';
    },
    @Request() req: any,
  ) {
    const teacherId = req.user?.sub ?? 'unknown';
    const created = this.svc.createAssignment(
      {
        title: body.title,
        dueDate: body.dueDate,
        subjectCode: body.subjectCode ?? body.courseCode ?? 'GEN',
        description: body.description ?? '',
        maxMarks: body.maxMarks ?? 25,
      },
      teacherId,
    );
    if (body.status === 'PUBLISHED') this.svc.publishAssignment(created.id);
    return {
      id: created.id, title: created.title, courseCode: created.subjectCode,
      courseName: created.subjectCode, classId: body.classId ?? '',
      className: body.classId ?? created.subjectCode, dueDate: created.dueDate,
      maxMarks: created.maxMarks, status: body.status ?? 'DRAFT',
      submissionCount: 0, totalStudents: 60, createdAt: new Date().toISOString(),
    };
  }

  @Patch('teacher/assignments/:id/publish')
  publishAssignment(@Param('id') id: string) {
    return this.svc.publishAssignment(id);
  }

  // Frontend uses PATCH /teacher/assignments/:id with {status} to publish/close
  @Patch('teacher/assignments/:id')
  updateAssignment(
    @Param('id') id: string,
    @Body() body: { status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED' },
  ) {
    if (body.status === 'PUBLISHED') return this.svc.publishAssignment(id);
    return this.svc.publishAssignment(id);
  }

  // Frontend grade endpoint uses PATCH and addresses by submission id, not USN
  @Patch('teacher/assignments/:id/submissions/:subId/grade')
  gradeSubmissionPatch(
    @Param('id') id: string,
    @Param('subId') subId: string,
    @Body() body: { marks: number; feedback: string },
  ) {
    // Look up submission by id, then route to the existing usn-keyed grader
    const sub = (this.svc.submissions as Array<{ id: string; usn: string }>).find((s) => s.id === subId);
    const usn = sub?.usn ?? subId;
    const result = this.svc.gradeSubmission(id, usn, body.marks, body.feedback);
    this.events.emitMarksUpdate({ subjectCode: result.assignmentId, sem: 0 });
    return result;
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
