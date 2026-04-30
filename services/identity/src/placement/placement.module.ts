import { Module } from '@nestjs/common';
import { PlacementController } from './placement.controller';
import { PlacementScoreService } from './placement-score.service';
import { PlacementMatchingService } from './placement-matching.service';
import { PlacementResumeService } from './placement-resume.service';

@Module({
  providers: [PlacementScoreService, PlacementMatchingService, PlacementResumeService],
  controllers: [PlacementController],
  exports: [PlacementScoreService],
})
export class PlacementModule {}
