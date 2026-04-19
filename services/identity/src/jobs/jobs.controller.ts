import {
  Controller,
  Get,
  Post,
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
