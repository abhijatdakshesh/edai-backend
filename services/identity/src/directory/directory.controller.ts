import { Controller, Get } from '@nestjs/common';

interface OrgNode {
  role: string;
  reportsTo?: string;
}

@Controller('directory')
export class DirectoryController {
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
