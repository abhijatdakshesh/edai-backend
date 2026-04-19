import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ScholarshipsService } from './scholarships.service';

@Controller('finance/scholarships')
export class ScholarshipsController {
  constructor(private readonly svc: ScholarshipsService) {}

  @Get('eligible')
  getEligible(@Query('scholarshipId') scholarshipId?: string) {
    return this.svc.getEligibleStudents(scholarshipId);
  }

  @Post('apply/:id')
  apply(
    @Param('id') scholarshipId: string,
    @Body() dto: { studentId: string },
  ) {
    return this.svc.apply(dto.studentId, scholarshipId);
  }
}
