import { Module } from '@nestjs/common';
import { FeesModule } from './fees/fees.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [FeesModule, HealthModule] })
export class AppModule {}
