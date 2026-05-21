import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { BulkImportService, BulkImportType, ImportRow } from './bulk-import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';

const TYPES: BulkImportType[] = ['students', 'teachers', 'parents'];

function isType(v: unknown): v is BulkImportType {
  return typeof v === 'string' && (TYPES as string[]).includes(v);
}

@Controller('bulk-import')
export class BulkImportController {
  constructor(private readonly svc: BulkImportService) {}

  /**
   * GET /api/bulk-import/template?type=students|teachers|parents
   * Returns an .xlsx file with the canonical column headers + a single
   * example row, so admins know exactly what data to fill in.
   */
  @Get('template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'DEAN', 'TRUSTEE')
  template(@Query('type') type: string, @Res() res: Response): void {
    if (!isType(type)) {
      throw new BadRequestException(`type must be one of: ${TYPES.join(', ')}`);
    }
    const buf = this.svc.buildTemplate(type);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bulk-import-${type}-template.xlsx"`,
    );
    res.send(buf);
  }

  /**
   * POST /api/bulk-import/validate
   * Body: { type, institutionId, rows: ImportRow[] }
   * Dry-run validation; never writes. Returns per-row pass/fail + reason.
   */
  @Post('validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'DEAN', 'TRUSTEE')
  validate(
    @Body() dto: { type: BulkImportType; institutionId?: string; rows: ImportRow[] },
  ) {
    if (!isType(dto?.type)) throw new BadRequestException(`type must be one of: ${TYPES.join(', ')}`);
    if (!Array.isArray(dto.rows)) throw new BadRequestException('rows must be an array');
    return this.svc.validate(dto.type, dto.rows, dto.institutionId);
  }

  /**
   * POST /api/bulk-import/commit
   * Body: { type, institutionId, rows: ImportRow[] }
   * Persists each row via UsersService.create(). Per-row results returned —
   * a single bad row never aborts the whole import.
   */
  @Post('commit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'DEAN', 'TRUSTEE')
  commit(
    @Body() dto: { type: BulkImportType; institutionId?: string; rows: ImportRow[] },
  ) {
    if (!isType(dto?.type)) throw new BadRequestException(`type must be one of: ${TYPES.join(', ')}`);
    if (!Array.isArray(dto.rows)) throw new BadRequestException('rows must be an array');
    return this.svc.commit(dto.type, dto.rows, dto.institutionId);
  }
}
