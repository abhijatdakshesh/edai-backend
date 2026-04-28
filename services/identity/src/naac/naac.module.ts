import { Module } from '@nestjs/common';
import { NaacController } from './naac.controller';
import { NaacService } from './naac.service';
import { NaacSsrService } from './naac-ssr.service';

@Module({
  controllers: [NaacController],
  providers: [NaacService, NaacSsrService],
  exports: [NaacService],
})
export class NaacModule {}
