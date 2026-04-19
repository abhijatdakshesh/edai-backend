import { Module } from '@nestjs/common';
import { BehaviorModule } from './behavior/behavior.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [BehaviorModule, HealthModule] })
export class AppModule {}
