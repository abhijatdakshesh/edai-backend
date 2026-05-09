import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IaService } from './ia.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsGateway } from '../events/events.gateway';

@UseGuards(JwtAuthGuard)
@Controller()
export class IaController {
  constructor(
    private readonly svc: IaService,
    private readonly events: EventsGateway,
  ) {}

  @Get('ia/teacher/marks')
  getMarks(
    @Query('subjectCode') subjectCode: string,
    @Query('sem') sem: string,
  ) {
    return this.svc.getMarks(subjectCode, parseInt(sem, 10));
  }

  @Post('ia/teacher/marks')
  saveMarks(
    @Body()
    body: {
      subjectCode: string;
      sem: number;
      marks: Array<{ usn: string; ia1: number; ia2: number; ia3: number }>;
    },
    @Request() req: any,
  ) {
    const teacherId = req.user?.sub ?? 'unknown';
    return this.svc.saveMarks(body.subjectCode, body.sem, body.marks, teacherId);
  }

  @Post('ia/teacher/marks/submit')
  submitForReview(
    @Body() body: { subjectCode: string; sem: number },
    @Request() req: any,
  ) {
    const teacherId = req.user?.sub ?? 'unknown';
    return this.svc.submitForReview(body.subjectCode, body.sem, teacherId);
  }

  @Get('ia/submissions')
  getAllSubmissions() {
    const teacherMeta: Record<string, { name: string; dept: string }> = {
      'u-faculty-01': { name: 'Rajesh Kumar', dept: 'CSE' },
      'teacher-002':  { name: 'Dr. Lakshmi Devi', dept: 'CSE' },
      'teacher-003':  { name: 'Prof. Suresh Kumar', dept: 'CSE' },
      'teacher-004':  { name: 'Dr. Meena Iyer', dept: 'CSE' },
      'teacher-005':  { name: 'Dr. Raj Patel', dept: 'CSE' },
    };
    const subjectName: Record<string, string> = {
      CS501: 'Data Structures & Algorithms',
      CS502: 'Database Management Systems',
      CS503: 'Computer Networks',
      CS504: 'Operating Systems',
      CS505: 'Software Engineering',
      CS506: 'Machine Learning',
      CS507: 'Microprocessors & Embedded Systems',
    };
    return this.svc.getAllSubmissions().map((s) => {
      const meta = teacherMeta[s.teacherId] ?? { name: s.teacherId, dept: '—' };
      return {
        id: s.id,
        teacherId: s.teacherId,
        teacherName: meta.name,
        subjectId: s.subjectCode,
        subjectCode: s.subjectCode,
        subjectName: subjectName[s.subjectCode] ?? s.subjectCode,
        dept: meta.dept,
        status: s.status === 'DRAFT' ? 'DRAFT' : s.status,
        submittedAt: s.submittedAt,
        confirmedAt: s.status === 'CONFIRMED' ? s.submittedAt : undefined,
        // Demo defaults — wire to real attendance/marks counts later
        studentCount: 60,
        marksEntered: s.status === 'DRAFT' ? 30 : 60,
      };
    });
  }

  @Post('ia/submissions/:id/confirm')
  confirm(@Param('id') id: string) {
    const result = this.svc.confirm(id);
    this.events.emitIaSubmissionUpdated({
      submissionId: id,
      status: result.status,
    });
    return result;
  }

  @Post('ia/submissions/remind')
  sendReminders(@Body() body: { teacherIds: string[] }) {
    return this.svc.sendReminders(body.teacherIds);
  }

  @Post('teacher/upload-results')
  uploadResults(@Body() body: { subjectCode: string; sem: number }) {
    return this.svc.uploadResults(body.subjectCode, body.sem);
  }

  @Patch('ia/teacher/marks/:subjectId/submit')
  submitBySubjectId(@Param('subjectId') subjectId: string, @Request() req: any) {
    const teacherId = req.user?.sub ?? 'unknown';
    return this.svc.submitForReview(subjectId, 5, teacherId);
  }

  @Get('academics/marks/subject/:subjectId')
  getMarksBySubject(@Param('subjectId') subjectId: string) {
    return this.svc.getMarksBySubject(subjectId);
  }

  @Post('academics/marks/bulk')
  bulkSaveMarks(
    @Body()
    body: {
      subjectCode: string;
      sem: number;
      marks: Array<{ usn: string; ia1: number; ia2: number; ia3: number }>;
    },
    @Request() req: any,
  ) {
    const _teacherId = req.user?.sub ?? 'unknown';
    return { jobId: `bulk-${Date.now()}`, status: 'QUEUED', count: body.marks.length };
  }

  @Post('academics/marks/bulk/confirm')
  confirmBulkMarks(@Body() body: { jobId: string }) {
    return { ok: true, jobId: body.jobId, confirmedAt: new Date().toISOString() };
  }
}
