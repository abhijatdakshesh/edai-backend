import { Module } from '@nestjs/common';
import { NlQueryController } from './nl-query.controller';
import { NlQueryService } from './nl-query.service';

@Module({
  controllers: [NlQueryController],
  providers: [NlQueryService],
  exports: [NlQueryService],
})
export class NlQueryModule {}
