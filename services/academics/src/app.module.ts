import { Module } from '@nestjs/common';
import { MarksModule } from './marks/marks.module';
import { DepartmentsModule } from './departments/departments.module';
import { ClassesModule } from './classes/classes.module';
import { CoursesModule } from './courses/courses.module';
import { PromotionModule } from './promotion/promotion.module';

@Module({
  imports: [
    MarksModule,
    DepartmentsModule,
    ClassesModule,
    CoursesModule,
    PromotionModule,
  ],
})
export class AppModule {}
