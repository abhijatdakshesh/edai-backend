import { Module } from '@nestjs/common';
import { EarlyWarningController } from './early-warning.controller';
import { EarlyWarningService } from './early-warning.service';

@Module({
  controllers: [EarlyWarningController],
  providers: [EarlyWarningService],
  exports: [EarlyWarningService],
})
export class EarlyWarningModule {}
