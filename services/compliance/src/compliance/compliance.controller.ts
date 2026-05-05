import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ComplianceService, type ReportType } from './compliance.service';

interface AuthRequest extends Request {
  user: { sub: string; institutionId: string; email: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post('reports')
  create(@Req() req: AuthRequest, @Body() body: { type: ReportType; academicYear: string }): unknown {
    return this.complianceService.create(body.type, req.user.institutionId, body.academicYear);
  }

  @Get('reports')
  list(@Req() req: AuthRequest): unknown {
    return this.complianceService.list(req.user.institutionId);
  }

  @Get('reports/:id')
  findById(@Req() req: AuthRequest, @Param('id') id: string): unknown {
    return this.complianceService.findById(id, req.user.institutionId);
  }

  @Post('reports/:id/evidence')
  addEvidence(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { criterionId: string; title: string; fileUrl: string; uploadedBy: string },
  ): unknown {
    return this.complianceService.addEvidence(id, req.user.institutionId, body);
  }

  @Post('reports/:id/generate')
  generate(@Req() req: AuthRequest, @Param('id') id: string): unknown {
    return this.complianceService.generate(id, req.user.institutionId);
  }

  @Post('reports/:id/approve')
  approve(@Req() req: AuthRequest, @Param('id') id: string): unknown {
    return this.complianceService.approve(id, req.user.institutionId);
  }

  @Post('reports/:id/submit')
  submit(@Req() req: AuthRequest, @Param('id') id: string): unknown {
    return this.complianceService.submit(id, req.user.institutionId);
  }
}
