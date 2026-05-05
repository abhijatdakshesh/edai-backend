import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NaacService } from './naac.service';
import type {
  Criterion1Input,
  Criterion2Input,
  Criterion3Input,
  Criterion4Input,
  Criterion5Input,
  Criterion6Input,
  Criterion7Input,
} from './naac-criterion-calculator.service';

interface AuthRequest extends Request {
  user: { sub: string; institutionId: string; email: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('naac')
export class NaacController {
  constructor(private readonly naacService: NaacService) {}

  @Get('dashboard')
  getDashboard(@Req() req: AuthRequest, @Query('academicYear') academicYear = '2024-25') {
    return this.naacService.getDashboard(req.user.institutionId, academicYear);
  }

  @Get('reports')
  listReports(@Req() req: AuthRequest, @Query('academicYear') academicYear?: string) {
    return this.naacService.listReports(req.user.institutionId, academicYear);
  }

  @Get('reports/:id')
  getReport(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.naacService.getReport(id, req.user.institutionId);
  }

  @Post('reports/generate')
  generateReport(
    @Req() req: AuthRequest,
    @Body() body: { academicYear: string; generatedBy: string; format: 'PDF' | 'EXCEL' },
  ) {
    return this.naacService.generateReport({ institutionId: req.user.institutionId, ...body });
  }

  @Post('criteria/1')
  computeCriterion1(
    @Req() req: AuthRequest,
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion1Input },
  ) {
    return this.naacService.computeAndSaveCriterion1({ institutionId: req.user.institutionId, ...body });
  }

  @Post('criteria/2')
  computeCriterion2(
    @Req() req: AuthRequest,
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion2Input },
  ) {
    return this.naacService.computeAndSaveCriterion2({ institutionId: req.user.institutionId, ...body });
  }

  @Post('criteria/3')
  computeCriterion3(
    @Req() req: AuthRequest,
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion3Input },
  ) {
    return this.naacService.computeAndSaveCriterion3({ institutionId: req.user.institutionId, ...body });
  }

  @Post('criteria/4')
  computeCriterion4(
    @Req() req: AuthRequest,
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion4Input },
  ) {
    return this.naacService.computeAndSaveCriterion4({ institutionId: req.user.institutionId, ...body });
  }

  @Post('criteria/5')
  computeCriterion5(
    @Req() req: AuthRequest,
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion5Input },
  ) {
    return this.naacService.computeAndSaveCriterion5({ institutionId: req.user.institutionId, ...body });
  }

  @Post('criteria/6')
  computeCriterion6(
    @Req() req: AuthRequest,
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion6Input },
  ) {
    return this.naacService.computeAndSaveCriterion6({ institutionId: req.user.institutionId, ...body });
  }

  @Post('criteria/7')
  computeCriterion7(
    @Req() req: AuthRequest,
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion7Input },
  ) {
    return this.naacService.computeAndSaveCriterion7({ institutionId: req.user.institutionId, ...body });
  }
}
