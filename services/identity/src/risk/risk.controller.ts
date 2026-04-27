import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RiskService } from './risk.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('risk')
@UseGuards(JwtAuthGuard)
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('students')
  getAtRiskStudents(
    @Query('department') department?: string,
    @Query('semester') semester?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('minScore') minScore?: string,
    @Query('limit') limit?: string,
  ) {
    return this.riskService.getAtRiskStudents({
      department,
      semester: semester ? parseInt(semester, 10) : undefined,
      riskLevel,
      minScore: minScore ? parseInt(minScore, 10) : 50,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Get('summary')
  getDepartmentSummary() {
    return this.riskService.getDepartmentSummary();
  }

  @Get('students/:usn')
  getStudentRisk(@Param('usn') usn: string) {
    return this.riskService.getStudentRisk(usn);
  }
}
