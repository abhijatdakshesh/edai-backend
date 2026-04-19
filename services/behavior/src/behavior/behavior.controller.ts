import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { BehaviorService, LogIncidentDto } from './behavior.service';
import { PatternsService } from '../patterns/patterns.service';

@Controller('behavior')
export class BehaviorController {
  constructor(
    private readonly svc: BehaviorService,
    private readonly patterns: PatternsService,
  ) {}

  @Post('incidents')
  log(@Body() dto: LogIncidentDto) {
    return this.svc.logIncident(dto);
  }

  @Get('incidents/student/:id')
  getStudentIncidents(@Param('id') studentId: string) {
    return this.svc.getStudentIncidents(studentId);
  }

  @Get('incidents/class/:id')
  getClassIncidents(@Param('id') classId: string) {
    return this.svc.getClassIncidents(classId);
  }

  @Get('patterns/student/:id')
  getStudentPatterns(@Param('id') studentId: string) {
    return this.patterns.getStudentPatterns(studentId);
  }

  @Get('patterns/institution/:id')
  getInstitutionPatterns(@Param('id') institutionId: string) {
    return this.patterns.getInstitutionPatterns(institutionId);
  }

  @Put('incidents/:id/resolve')
  resolve(@Param('id') id: string, @Body() dto: { notes: string }) {
    return this.svc.resolve(id, dto.notes);
  }

  @Get('dashboard')
  dashboard(@Query('institutionId') institutionId: string) {
    return this.svc.getDashboard(institutionId ?? 'default');
  }
}
