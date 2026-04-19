import { Module } from '@nestjs/common';
import { FinanceModule } from './finance/finance.module';
import { ScholarshipsModule } from './scholarships/scholarships.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [FinanceModule, ScholarshipsModule, HealthModule] })
export class AppModule {}
