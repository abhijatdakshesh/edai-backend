import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PlacementsService, type ApplicationStatus } from './placements.service';

@Controller('placements')
export class PlacementsController {
  constructor(private readonly placementsService: PlacementsService) {}

  @Post('drives')
  createDrive(@Body() body: Record<string, unknown>): unknown {
    return this.placementsService.createDrive(body as Parameters<PlacementsService['createDrive']>[0]);
  }

  @Get('drives')
  listDrives(@Query('institutionId') institutionId = 'rvce'): unknown {
    return this.placementsService.listDrives(institutionId);
  }

  @Post('drives/:driveId/apply')
  apply(@Param('driveId') driveId: string, @Body('studentId') studentId: string): unknown {
    return this.placementsService.apply(driveId, studentId);
  }

  @Post('applications/:id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: ApplicationStatus): unknown {
    return this.placementsService.updateApplicationStatus(id, status);
  }

  @Get('students/:studentId/applications')
  studentApplications(@Param('studentId') studentId: string): unknown {
    return this.placementsService.studentApplications(studentId);
  }
}
