import { Module } from '@nestjs/common';
import { GrievanceController } from './grievance.controller';
import { GrievanceService } from './grievance.service';

@Module({ controllers: [GrievanceController], providers: [GrievanceService] })
export class GrievanceModule {}
