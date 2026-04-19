import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SapBridgeService, type SyncJobType, type SyncJobStatus } from './sap-bridge.service';

@Controller('sap-bridge')
export class SapBridgeController {
  constructor(private readonly sapBridgeService: SapBridgeService) {}

  @Post('sync')
  enqueue(@Body() body: { type: SyncJobType; payload: Record<string, unknown> }): unknown {
    return this.sapBridgeService.enqueue(body.type, body.payload);
  }

  @Get('jobs')
  listJobs(@Query('status') status?: SyncJobStatus): unknown {
    return this.sapBridgeService.listJobs(status);
  }

  @Post('jobs/retry-dlq')
  retryDlq(): unknown {
    return this.sapBridgeService.retryDlq();
  }

  @Get('odata')
  odataQuery(
    @Query('entity') entity: string,
    @Query('filter') filter?: string,
  ): unknown {
    return this.sapBridgeService.odataQuery(entity, filter);
  }
}
