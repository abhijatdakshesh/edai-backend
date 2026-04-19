import { Module } from '@nestjs/common';
import { AttendanceModule } from './attendance/attendance.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AttendanceModule, HealthModule],
})
export class AppModule {}
