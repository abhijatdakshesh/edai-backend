import { Module } from '@nestjs/common';
import { FeesApiController } from './fees-api.controller';
import { FeesApiService } from './fees-api.service';

@Module({
  controllers: [FeesApiController],
  providers: [FeesApiService],
  exports: [FeesApiService],
})
export class FeesApiModule {}
