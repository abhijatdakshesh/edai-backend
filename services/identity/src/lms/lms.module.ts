import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LmsController } from './lms.controller';
import { LmsHotlineController } from './lms-hotline.controller';
import { LmsService } from './lms.service';
import { LmsCronService } from './lms-cron.service';
import {
  LessonEntity, LessonProgressEntity, ModuleEntity, TopicMasteryEntity,
} from '../entities/lms.entity';
import { CommsModule } from '../comms/comms.module';

@Module({
  imports: [
    // CommsModule is required for the Voice-Tutor Hotline (Sarvam TTS audio
    // store, signed URL, conversation state). Re-imported here rather than
    // making CommsService global, to keep the dep graph explicit.
    CommsModule,
    ...(process.env['DATABASE_URL']
      ? [TypeOrmModule.forFeature([ModuleEntity, LessonEntity, LessonProgressEntity, TopicMasteryEntity])]
      : []),
  ],
  controllers: [LmsController, LmsHotlineController],
  providers: [LmsService, LmsCronService],
  exports: [LmsService, LmsCronService],
})
export class LmsModule {}
