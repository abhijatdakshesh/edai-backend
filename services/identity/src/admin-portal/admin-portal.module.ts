import { Module } from '@nestjs/common';
import { AdminPortalController } from './admin-portal.controller';
import { AdminPortalService } from './admin-portal.service';
import { FeesApiModule } from '../fees-api/fees-api.module';

@Module({
  imports: [FeesApiModule],
  controllers: [AdminPortalController],
  providers: [AdminPortalService],
  exports: [AdminPortalService],
})
export class AdminPortalModule {}
