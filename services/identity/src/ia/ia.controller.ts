import {
  Controller,
  Get,
  Post,
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
    return this.svc.getAllSubmissions();
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
}
