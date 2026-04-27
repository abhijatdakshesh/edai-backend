import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'PRINCIPAL', 'HOD')
@Controller()
export class PromotionController {
  constructor(private readonly svc: PromotionService) {}

  @Get('promotion/batches')
  getBatches() {
    return this.svc.getBatches();
  }

  @Post('promotion/generate')
  generate(@Body() body: { semester: number; dept: string }) {
    return this.svc.generate(body.semester, body.dept);
  }

  @Get('promotion/detention-list')
  getDetentionList(
    @Query('dept') dept?: string,
    @Query('semester') semester?: string,
  ) {
    return this.svc.getDetentionList(dept, semester ? parseInt(semester, 10) : undefined);
  }

  @Get('promotion/batches/:id')
  getBatchById(@Param('id') id: string) {
    return this.svc.getBatchById(id);
  }

  @Post('promotion/batches/:id/promote')
  async promote(@Param('id') id: string) {
    return this.svc.promote(id);
  }

  @Patch('promotion/batches/:id/override')
  async override(
    @Param('id') id: string,
    @Body() body: { overrides: Array<{ usn: string; decision: 'PROMOTE' | 'DETAIN' }> },
  ) {
    return this.svc.override(id, body.overrides);
  }
}
