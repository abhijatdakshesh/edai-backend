import { Module } from '@nestjs/common';
import { DataExportsController } from './data-exports.controller';
import { DataExportsService } from './data-exports.service';

@Module({
  controllers: [DataExportsController],
  providers: [DataExportsService],
  exports: [DataExportsService],
})
export class DataExportsModule {}
