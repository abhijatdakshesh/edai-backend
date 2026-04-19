import { Module } from '@nestjs/common';
import { SapBridgeModule } from './sap-bridge/sap-bridge.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [SapBridgeModule, HealthModule] })
export class AppModule {}
