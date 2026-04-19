import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MarksService, BulkMarksEntryDto } from './marks.service';
import { AiValidationFlag } from '../entities/marks.entity';

@Controller('academics')
export class MarksController {
  constructor(private readonly svc: MarksService) {}

  @Post('marks/bulk')
  validateBulk(@Body() dto: BulkMarksEntryDto) {
    return this.svc.validateBulk(dto);
  }

  @Post('marks/bulk/confirm')
  confirmBulk(@Body() body: { dto: BulkMarksEntryDto; flags: AiValidationFlag[] }) {
    return this.svc.confirmBulk(body.dto, body.flags);
  }

  @Get('marks/subject/:id')
  getBySubject(@Param('id') id: string) {
    return this.svc.getBySubject(id);
  }

  @Get('marks/student/:id')
  getByStudent(@Param('id') id: string) {
    return this.svc.getByStudent(id);
  }

  @Post('marks/verify/:id')
  verify(@Param('id') id: string, @Body() dto: { verifiedBy: string }) {
    return this.svc.verify(id, dto.verifiedBy);
  }

  @Get('reports/teacher/:id')
  getTeacherReports(@Param('id') id: string) {
    return this.svc.getTeacherReports(id);
  }

  @Post('reports/teacher/:id/generate')
  generateReport(@Param('id') id: string) {
    return this.svc.generateDailyReport(id);
  }

  @Get('predictive/at-risk')
  getAtRisk() {
    return this.svc.getAtRiskPredictions('');
  }
}
