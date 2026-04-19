import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MentorshipService } from './mentorship.service';

@Controller('mentorship')
export class MentorshipController {
  constructor(private readonly mentorshipService: MentorshipService) {}

  @Post('assign')
  assign(@Body() body: { mentorId: string; studentId: string; institutionId: string }): unknown {
    return this.mentorshipService.assignMentor(body.mentorId, body.studentId, body.institutionId);
  }

  @Post('sessions')
  schedule(@Body() body: { mentorId: string; studentId: string; scheduledAt: string }): unknown {
    return this.mentorshipService.scheduleSession(body.mentorId, body.studentId, body.scheduledAt);
  }

  @Post('sessions/:id/complete')
  complete(@Param('id') id: string, @Body('notes') notes: string): unknown {
    return this.mentorshipService.completeSession(id, notes);
  }

  @Get('student/:studentId/sessions')
  sessions(@Param('studentId') studentId: string): unknown {
    return this.mentorshipService.sessionsByStudent(studentId);
  }

  @Get('student/:studentId/mentor')
  mentor(@Param('studentId') studentId: string): unknown {
    return this.mentorshipService.mappingByStudent(studentId);
  }
}
