import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { PlacementDriveEntity, AlumniOutcomeEntity } from '../entities/placement.entity';

@Module({
  imports: process.env['DATABASE_URL']
    ? [TypeOrmModule.forFeature([PlacementDriveEntity, AlumniOutcomeEntity])]
    : [],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
