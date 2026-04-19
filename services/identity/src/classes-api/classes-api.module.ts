import { Module } from '@nestjs/common';
import { ClassesApiController } from './classes-api.controller';
import { ClassesApiService } from './classes-api.service';

@Module({
  controllers: [ClassesApiController],
  providers: [ClassesApiService],
  exports: [ClassesApiService],
})
export class ClassesApiModule {}
