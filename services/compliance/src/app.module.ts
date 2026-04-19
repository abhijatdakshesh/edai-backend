import { Module } from '@nestjs/common';
import { ComplianceModule } from './compliance/compliance.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [ComplianceModule, HealthModule] })
export class AppModule {}
