import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

@Module({ controllers: [ComplianceController], providers: [ComplianceService, JwtAuthGuard] })
export class ComplianceModule {}
