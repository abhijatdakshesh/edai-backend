import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VtuController } from './vtu.controller';
import { VtuService } from './vtu.service';
import { EventsModule } from '../events/events.module';
import { VtuWindowEntity, VtuEligibilityEntity, VtuRegistrationEntity } from '../entities/vtu.entity';

@Module({
  imports: [
    EventsModule,
    ...(process.env['DATABASE_URL']
      ? [TypeOrmModule.forFeature([VtuWindowEntity, VtuEligibilityEntity, VtuRegistrationEntity])]
      : []),
  ],
  controllers: [VtuController],
  providers: [VtuService],
  exports: [VtuService],
})
export class VtuModule {}
