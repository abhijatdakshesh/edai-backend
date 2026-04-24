import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class JobsController {
  constructor(private readonly svc: JobsService) {}

  @Get('jobs')
  getJobs() {
    return this.svc.getJobs();
  }

  // Static routes BEFORE param routes to avoid routing conflicts
  @Get('jobs/applications/me')
  getMyApplications(@Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.getMyApplications(usn);
  }

  @Patch('jobs/applications/:applicationId/withdraw')
  withdrawApplication(@Param('applicationId') id: string) {
    return this.svc.withdraw(id);
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string) {
    return this.svc.getJob(id);
  }

  @Post('jobs/:id/apply')
  apply(@Param('id') id: string, @Request() req: any) {
    const usn = req.user?.sapId ?? req.user?.sub ?? 'UNKNOWN';
    return this.svc.apply(id, usn);
  }

  @Get('placements/predictions')
  getPredictions(
    @Query('dept') dept: string,
    @Query('likelihood') likelihood: string,
  ) {
    return this.svc.getPredictions(dept, likelihood);
  }
}
