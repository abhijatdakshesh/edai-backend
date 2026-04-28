import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { NaacService } from './naac.service';
import { NaacSsrService } from './naac-ssr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('naac')
@UseGuards(JwtAuthGuard)
export class NaacController {
  constructor(
    private readonly naacService: NaacService,
    private readonly ssrService: NaacSsrService,
  ) {}

  /** GET /api/naac/dashboard — live metrics + predicted CGPA */
  @Get('dashboard')
  getDashboard() {
    return this.naacService.getDashboard();
  }

  /** POST /api/naac/ssr/:criterionId — generate SSR paragraph for one criterion */
  @Post('ssr/:criterionId')
  generateSsrParagraph(@Param('criterionId') criterionId: string) {
    return this.ssrService.generateCriterionParagraph(criterionId);
  }

  /** POST /api/naac/ssr/full/generate — generate all 7 criteria SSR paragraphs */
  @Post('ssr/full/generate')
  generateFullSsr() {
    return this.ssrService.generateFullSsr();
  }
}
