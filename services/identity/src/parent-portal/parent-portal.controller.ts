import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ParentPortalService } from './parent-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class ParentPortalController {
  constructor(private readonly svc: ParentPortalService) {}

  @Get('parent/dashboard')
  getDashboard(@Request() req: any) {
    const parentId = req.user?.sub ?? 'unknown';
    return this.svc.getDashboard(parentId);
  }

  @Get('parent/children')
  getChildren(@Request() req: any) {
    const parentId = req.user?.sub ?? 'unknown';
    return this.svc.getChildren(parentId);
  }

  @Get('parent/children/:usn/attendance')
  getChildAttendance(@Param('usn') usn: string) {
    return this.svc.getChildAttendance(usn);
  }

  @Get('parent/children/:usn/results')
  getChildResults(@Param('usn') usn: string) {
    return this.svc.getChildResults(usn);
  }

  @Get('parent/children/:usn/fees')
  getChildFees(@Param('usn') usn: string) {
    return this.svc.getChildFees(usn);
  }
}
