import { Module } from '@nestjs/common';
import { AbcCreditsController } from './abc-credits.controller';
import { AbcCreditsService } from './abc-credits.service';

@Module({
  controllers: [AbcCreditsController],
  providers: [AbcCreditsService],
  exports: [AbcCreditsService],
})
export class AbcCreditsModule {}
