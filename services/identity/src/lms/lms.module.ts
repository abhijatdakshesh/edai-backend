import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LmsController } from './lms.controller';
import { LmsService } from './lms.service';
import {
  LessonEntity, LessonProgressEntity, ModuleEntity, TopicMasteryEntity,
} from '../entities/lms.entity';

@Module({
  imports: [
    ...(process.env['DATABASE_URL']
      ? [TypeOrmModule.forFeature([ModuleEntity, LessonEntity, LessonProgressEntity, TopicMasteryEntity])]
      : []),
  ],
  controllers: [LmsController],
  providers: [LmsService],
  exports: [LmsService],
})
export class LmsModule {}
