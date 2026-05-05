import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface OrgNode {
  role: string;
  reportsTo?: string;
}

@Controller('directory')
export class DirectoryController {
  @UseGuards(JwtAuthGuard)
  @Get('org-chart')
  orgChart(): { institution: string; hierarchy: OrgNode[] } {
    return {
      institution: 'RVCE',
      hierarchy: [
        { role: 'TRUSTEE' },
        { role: 'PRINCIPAL', reportsTo: 'TRUSTEE' },
        { role: 'DEAN', reportsTo: 'PRINCIPAL' },
        { role: 'HOD', reportsTo: 'DEAN' },
        { role: 'FACULTY', reportsTo: 'HOD' },
        { role: 'COUNSELLOR', reportsTo: 'DEAN' },
      ],
    };
  }
}
