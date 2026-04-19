import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { CoursesModule } from '../courses/courses.module';
import { AttendanceApiModule } from '../attendance-api/attendance-api.module';
import { AssignmentsApiModule } from '../assignments-api/assignments-api.module';
import { IaModule } from '../ia/ia.module';
import { FeesApiModule } from '../fees-api/fees-api.module';
import { VtuModule } from '../vtu/vtu.module';
import { WellnessModule } from '../wellness/wellness.module';
import { JobsModule } from '../jobs/jobs.module';
import { ClassesApiModule } from '../classes-api/classes-api.module';
import { StudentPortalModule } from '../student-portal/student-portal.module';
import { ParentPortalModule } from '../parent-portal/parent-portal.module';
import { CommsModule } from '../comms/comms.module';
import { AdminPortalModule } from '../admin-portal/admin-portal.module';

@Module({
  imports: [
    CoursesModule,
    AttendanceApiModule,
    AssignmentsApiModule,
    IaModule,
    FeesApiModule,
    VtuModule,
    WellnessModule,
    JobsModule,
    ClassesApiModule,
    StudentPortalModule,
    ParentPortalModule,
    CommsModule,
    AdminPortalModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
