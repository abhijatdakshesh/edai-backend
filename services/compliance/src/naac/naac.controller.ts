import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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

@Controller('naac')
export class NaacController {
  constructor(private readonly naacService: NaacService) {}

  @Get('dashboard')
  getDashboard(@Query('academicYear') academicYear = '2024-25') {
    return this.naacService.getDashboard(academicYear);
  }

  @Post('criteria/1')
  computeCriterion1(
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion1Input },
  ) {
    return this.naacService.computeAndSaveCriterion1(body);
  }

  @Post('criteria/2')
  computeCriterion2(
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion2Input },
  ) {
    return this.naacService.computeAndSaveCriterion2(body);
  }

  @Post('criteria/3')
  computeCriterion3(
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion3Input },
  ) {
    return this.naacService.computeAndSaveCriterion3(body);
  }

  @Post('criteria/4')
  computeCriterion4(
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion4Input },
  ) {
    return this.naacService.computeAndSaveCriterion4(body);
  }

  @Post('criteria/5')
  computeCriterion5(
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion5Input },
  ) {
    return this.naacService.computeAndSaveCriterion5(body);
  }

  @Post('criteria/6')
  computeCriterion6(
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion6Input },
  ) {
    return this.naacService.computeAndSaveCriterion6(body);
  }

  @Post('criteria/7')
  computeCriterion7(
    @Body() body: { academicYear: string; dataPeriodEnd: string; input: Criterion7Input },
  ) {
    return this.naacService.computeAndSaveCriterion7(body);
  }
}
