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
import { WellnessService } from './wellness.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class WellnessController {
  constructor(private readonly svc: WellnessService) {}

  @Get('counselor/slots')
  getSlots() {
    return this.svc.getSlots();
  }

  @Get('counselor/sessions/me')
  getMySessions(@Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getMySessions(usn);
  }

  @Post('counselor/sessions')
  bookSession(
    @Body() body: { slotId: string; reason: string },
    @Request() req: any,
  ) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.bookSession(usn, body.slotId, body.reason);
  }

  @Get('wellness/risk-score/:usn')
  getRiskScore(@Param('usn') usn: string) {
    return this.svc.getRiskScore(usn);
  }

  @Get('wellness/study-plan/me')
  getStudyPlan(@Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getStudyPlan(usn);
  }

  @Patch('wellness/study-plan/tasks/:id')
  updateTask(
    @Param('id') id: string,
    @Body() body: { done: boolean },
  ) {
    return this.svc.updateTask(id, body.done);
  }

  @Get('wellness/stress-resources')
  getResources() {
    return this.svc.getResources();
  }

  @Post('counselor/book')
  bookSessionAlias(
    @Body() body: { slotId: string; reason: string },
    @Request() req: any,
  ) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.bookSession(usn, body.slotId, body.reason);
  }

  @Get('wellness/risk-score/me')
  getMyRiskScore(@Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getRiskScore(usn);
  }

  @Patch('wellness/study-plan/tasks/:id/complete')
  completeTask(@Param('id') id: string) {
    return this.svc.updateTask(id, true);
  }

  @Get('wellness/resources')
  getResourcesAlias() {
    return this.svc.getResources();
  }

  @Post('wellness/stress-assessment')
  stressAssessment(
    @Body() body: { answers: Record<string, number> },
    @Request() req: any,
  ) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.assessStress(usn, body.answers);
  }

  @Post('wellness/study-plan/generate')
  generateStudyPlan(
    @Body() body: { examDate: string; subjects: string[] },
    @Request() req: any,
  ) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.generateStudyPlan(usn, body.examDate, body.subjects);
  }
}
