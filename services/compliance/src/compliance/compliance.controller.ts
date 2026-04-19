import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ComplianceService, type ReportType } from './compliance.service';

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post('reports')
  create(@Body() body: { type: ReportType; institutionId: string; academicYear: string }): unknown {
    return this.complianceService.create(body.type, body.institutionId, body.academicYear);
  }

  @Get('reports')
  list(@Query('institutionId') institutionId = 'rvce'): unknown {
    return this.complianceService.list(institutionId);
  }

  @Get('reports/:id')
  findById(@Param('id') id: string): unknown {
    return this.complianceService.findById(id);
  }

  @Post('reports/:id/evidence')
  addEvidence(
    @Param('id') id: string,
    @Body() body: { criterionId: string; title: string; fileUrl: string; uploadedBy: string },
  ): unknown {
    return this.complianceService.addEvidence(id, body);
  }

  @Post('reports/:id/generate')
  generate(@Param('id') id: string): unknown {
    return this.complianceService.generate(id);
  }

  @Post('reports/:id/approve')
  approve(@Param('id') id: string): unknown {
    return this.complianceService.approve(id);
  }

  @Post('reports/:id/submit')
  submit(@Param('id') id: string): unknown {
    return this.complianceService.submit(id);
  }
}
