import { Module } from '@nestjs/common';
import { AssignmentsModule } from './assignments/assignments.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [AssignmentsModule, HealthModule] })
export class AppModule {}
