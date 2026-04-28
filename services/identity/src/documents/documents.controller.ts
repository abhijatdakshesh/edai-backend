import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { UnauthorizedException } from '@nestjs/common';
import { DocumentsService, RequestDocumentDto } from './documents.service';

interface AuthRequest extends Request {
  user: { id?: string; sapId?: string; sub?: string; usn?: string; email?: string; role?: string };
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ── Student routes ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post()
  requestDocument(@Req() req: AuthRequest, @Body() dto: RequestDocumentDto) {
    const usn = req.user.sapId ?? req.user.sub ?? req.user.id;
    if (!usn) throw new UnauthorizedException('Cannot identify user from token');
    return this.documentsService.requestDocument(usn, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  getMyRequests(@Req() req: AuthRequest) {
    const usn = req.user.sapId ?? req.user.sub ?? req.user.id;
    if (!usn) throw new UnauthorizedException('Cannot identify user from token');
    return this.documentsService.getMyRequests(usn);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my/:id')
  getRequest(@Param('id') id: string, @Req() req: AuthRequest) {
    const usn = req.user.sapId ?? req.user.sub ?? req.user.id;
    if (!usn) throw new UnauthorizedException('Cannot identify user from token');
    return this.documentsService.getRequest(id, usn);
  }

  // ── Public routes ───────────────────────────────────────────────────────────

  @Get('verify/:uuid')
  verifyDocument(@Param('uuid') uuid: string) {
    return this.documentsService.verifyDocument(uuid);
  }

  @Get('download/:uuid')
  async downloadDocument(
    @Param('uuid') uuid: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const pdfBuf = await this.documentsService.generatePdf(uuid, token);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="document-${uuid}.pdf"`,
      'Content-Length': pdfBuf.length,
      'Cache-Control': 'no-store',
    });
    res.end(pdfBuf);
  }

  // ── Admin routes ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD')
  @Get('admin/pending')
  getAllPending() {
    return this.documentsService.getAllPending();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD')
  @Post('admin/approve/:id')
  @HttpCode(HttpStatus.OK)
  approveRequest(@Param('id') id: string, @Req() req: AuthRequest) {
    const adminUsn = req.user.sapId ?? req.user.sub ?? req.user.id ?? 'UNKNOWN';
    return this.documentsService.approveRequest(id, adminUsn);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD')
  @Post('admin/reject/:id')
  @HttpCode(HttpStatus.OK)
  rejectRequest(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: AuthRequest,
  ) {
    const adminUsn = req.user.sapId ?? req.user.sub ?? req.user.id ?? 'UNKNOWN';
    return this.documentsService.rejectRequest(id, adminUsn, reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL')
  @Post('admin/revoke/:id')
  @HttpCode(HttpStatus.OK)
  revokeDocument(@Param('id') id: string, @Req() req: AuthRequest) {
    const adminUsn = req.user.sapId ?? req.user.sub ?? req.user.id ?? 'UNKNOWN';
    return this.documentsService.revokeDocument(id, adminUsn);
  }
}
