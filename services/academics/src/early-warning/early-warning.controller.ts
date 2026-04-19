import { Controller, Get, Param, Query } from '@nestjs/common';
import { EarlyWarningService } from './early-warning.service';

@Controller('early-warning')
export class EarlyWarningController {
  constructor(private readonly earlyWarningService: EarlyWarningService) {}

  @Get(':studentId')
  assess(
    @Param('studentId') studentId: string,
    @Query('attendance') attendance = '80',
    @Query('cgpa') cgpa = '7.0',
  ): unknown {
    return this.earlyWarningService.assess(studentId, parseFloat(attendance), parseFloat(cgpa));
  }
}
