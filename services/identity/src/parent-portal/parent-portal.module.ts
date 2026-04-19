import { Module } from '@nestjs/common';
import { ParentPortalController } from './parent-portal.controller';
import { ParentPortalService } from './parent-portal.service';
import { AttendanceApiModule } from '../attendance-api/attendance-api.module';
import { FeesApiModule } from '../fees-api/fees-api.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [AttendanceApiModule, FeesApiModule, CoursesModule],
  controllers: [ParentPortalController],
  providers: [ParentPortalService],
  exports: [ParentPortalService],
})
export class ParentPortalModule {}
