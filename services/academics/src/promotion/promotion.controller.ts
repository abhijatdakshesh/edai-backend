import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PromotionService, PromotionStatus } from './promotion.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../guards/roles.decorator';

@Controller('promotion')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  /**
   * GET /api/promotion/batches
   * List all promotion batches.
   */
  @Get('batches')
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.promotionService.findAll();
  }

  /**
   * GET /api/promotion/batches/:id
   * Get a specific batch with full student eligibility list.
   */
  @Get('batches/:id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.promotionService.findById(id);
  }

  /**
   * POST /api/promotion/generate
   * Generate eligibility report for a class.
   * Body: { classId, className, fromSemester, academicYear, criteria? }
   */
  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL')
  generate(
    @Body()
    body: {
      classId: string;
      className: string;
      fromSemester: number;
      academicYear: string;
      criteria?: {
        minAttendancePct?: number;
        minIaScore?: number;
        feeClearanceRequired?: boolean;
      };
    },
  ) {
    return this.promotionService.generateEligibilityReport(body);
  }

  /**
   * PATCH /api/promotion/batches/:id/override
   * Override a student's promotion status.
   * Body: { studentUsn, status, note, overriddenBy }
   */
  @Patch('batches/:id/override')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'HOD', 'PRINCIPAL')
  override(
    @Param('id') batchId: string,
    @Body()
    body: {
      studentUsn: string;
      status: PromotionStatus;
      note: string;
      overriddenBy: string;
    },
  ) {
    return this.promotionService.overrideStudent(
      batchId,
      body.studentUsn,
      body,
    );
  }

  /**
   * POST /api/promotion/batches/:id/promote
   * Execute batch promotion for all eligible + conditional students.
   * Body: { promotedBy }
   */
  @Post('batches/:id/promote')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL')
  promote(
    @Param('id') batchId: string,
    @Body() body: { promotedBy: string },
  ) {
    return this.promotionService.executeBatchPromotion(
      batchId,
      body.promotedBy,
    );
  }

  /**
   * GET /api/promotion/detention-list?classId=&semester=
   * View detained students across all batches.
   */
  @Get('detention-list')
  @UseGuards(JwtAuthGuard)
  getDetentionList(
    @Query('classId') classId?: string,
    @Query('semester') semester?: string,
  ) {
    return this.promotionService.getDetentionList(
      classId,
      semester ? parseInt(semester, 10) : undefined,
    );
  }
}
