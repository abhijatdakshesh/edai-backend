import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommsController, PublicCommsController } from './comms.controller';
import { CommsService } from './comms.service';
import { ConsentService } from './consent.service';
import { EventsModule } from '../events/events.module';
import { StudentPortalModule } from '../student-portal/student-portal.module';
import { AiCallLogEntity, AnnouncementEntity } from '../entities/comms.entity';

@Module({
  imports: [
    EventsModule,
    StudentPortalModule,
    ...(process.env['DATABASE_URL']
      ? [TypeOrmModule.forFeature([AiCallLogEntity, AnnouncementEntity])]
      : []),
  ],
  controllers: [PublicCommsController, CommsController],
  providers: [CommsService, ConsentService],
  exports: [CommsService, ConsentService],
})
export class CommsModule {}
