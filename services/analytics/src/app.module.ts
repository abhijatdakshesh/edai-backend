import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { DataExportsModule } from './exports/data-exports.module';

@Module({ imports: [AnalyticsModule, DataExportsModule] })
export class AppModule {}
