import { Module } from '@nestjs/common';
import { ParentCommsController } from './parent-comms.controller';
import { ParentCommsService } from './parent-comms.service';

@Module({
  controllers: [ParentCommsController],
  providers: [ParentCommsService],
  exports: [ParentCommsService],
})
export class ParentCommsModule {}
