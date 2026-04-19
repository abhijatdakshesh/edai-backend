import { Module } from '@nestjs/common';
import { SapBridgeController } from './sap-bridge.controller';
import { SapBridgeService } from './sap-bridge.service';

@Module({ controllers: [SapBridgeController], providers: [SapBridgeService] })
export class SapBridgeModule {}
