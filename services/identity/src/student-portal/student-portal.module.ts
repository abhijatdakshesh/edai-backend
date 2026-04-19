import { Module } from '@nestjs/common';
import { StudentPortalController } from './student-portal.controller';
import { StudentPortalService } from './student-portal.service';
import { AttendanceApiModule } from '../attendance-api/attendance-api.module';
import { AssignmentsApiModule } from '../assignments-api/assignments-api.module';
import { FeesApiModule } from '../fees-api/fees-api.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [AttendanceApiModule, AssignmentsApiModule, FeesApiModule, CoursesModule],
  controllers: [StudentPortalController],
  providers: [StudentPortalService],
  exports: [StudentPortalService],
})
export class StudentPortalModule {}
