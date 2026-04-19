import { Module } from '@nestjs/common';
import { BehaviorController } from './behavior.controller';
import { BehaviorService } from './behavior.service';
import { PatternsService } from '../patterns/patterns.service';

@Module({
  controllers: [BehaviorController],
  providers: [BehaviorService, PatternsService],
  exports: [BehaviorService, PatternsService],
})
export class BehaviorModule {}
