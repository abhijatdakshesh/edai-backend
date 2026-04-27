import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentEntity, ParentStudentLinkEntity } from '../entities/student-orm.entity';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: process.env['DATABASE_URL']
    ? [TypeOrmModule.forFeature([StudentEntity, ParentStudentLinkEntity])]
    : [],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
