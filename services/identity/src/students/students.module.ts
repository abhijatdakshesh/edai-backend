import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentEntity, ParentStudentLinkEntity } from '../entities/student-orm.entity';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [
    // Conditionally imported — TypeORM is only registered when DATABASE_URL is set.
    // @Optional() in StudentsService handles the null case gracefully.
    TypeOrmModule.forFeature([StudentEntity, ParentStudentLinkEntity]),
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
