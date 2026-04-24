import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { ParentsModule } from './parents/parents.module';
import { StudentsModule } from './students/students.module';
import { DirectoryModule } from './directory/directory.module';
import { HealthModule } from './health/health.module';
import { RolesGuard } from './roles/roles.guard';
import { EventsModule } from './events/events.module';
import { CoursesModule } from './courses/courses.module';
import { AttendanceApiModule } from './attendance-api/attendance-api.module';
import { AssignmentsApiModule } from './assignments-api/assignments-api.module';
import { IaModule } from './ia/ia.module';
import { FeesApiModule } from './fees-api/fees-api.module';
import { VtuModule } from './vtu/vtu.module';
import { WellnessModule } from './wellness/wellness.module';
import { JobsModule } from './jobs/jobs.module';
import { ClassesApiModule } from './classes-api/classes-api.module';
import { StudentPortalModule } from './student-portal/student-portal.module';
import { ParentPortalModule } from './parent-portal/parent-portal.module';
import { AdminPortalModule } from './admin-portal/admin-portal.module';
import { CommsModule } from './comms/comms.module';
import { DepartmentsModule } from './departments/departments.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    // Existing
    AuthModule,
    UsersModule,
    RolesModule,
    StudentsModule,
    ParentsModule,
    DirectoryModule,
    HealthModule,
    // New infrastructure
    EventsModule,
    // Domain modules
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
    AdminPortalModule,
    CommsModule,
    DepartmentsModule,
    // Seed (must be last — imports all domain modules)
    SeedModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
