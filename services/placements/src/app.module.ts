import { Module } from '@nestjs/common';
import { PlacementsModule } from './placements/placements.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [PlacementsModule, HealthModule] })
export class AppModule {}
