import { Module } from '@nestjs/common';
import { RecruiterController } from './recruiter.controller';
import { RecruiterService } from './recruiter.service';

@Module({
  controllers: [RecruiterController],
  providers: [RecruiterService],
  exports: [RecruiterService],
})
export class RecruiterModule {}
