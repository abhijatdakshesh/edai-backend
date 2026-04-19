import { Module } from '@nestjs/common';
import { GrievanceModule } from './grievance/grievance.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [GrievanceModule, HealthModule] })
export class AppModule {}
