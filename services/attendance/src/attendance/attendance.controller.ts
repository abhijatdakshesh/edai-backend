import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto, MarkBulkAttendanceDto, ExcuseAbsenceDto } from '../dto/attendance.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  @Post('mark')
  markAttendance(@Body() dto: MarkAttendanceDto) {
    return this.svc.markAttendance(dto);
  }

  @Post('mark/bulk')
  markBulk(@Body() dto: MarkBulkAttendanceDto) {
    return this.svc.markBulk(dto);
  }

  @Get('students/:id/summary')
  getStudentSummary(@Param('id') id: string) {
    return this.svc.getStudentSummary(id);
  }

  @Get('classes/:id/today')
  getClassToday(@Param('id') classId: string) {
    return this.svc.getClassToday(classId);
  }

  @Get('classes/:id/absentees')
  getAbsenteesToday(@Param('id') classId: string) {
    return this.svc.getAbsenteesToday(classId);
  }

  @Get('at-risk')
  getAtRisk(@Query('institutionId') institutionId?: string) {
    return this.svc.getAtRisk(institutionId);
  }

  /**
   * GET /api/attendance/classes/:id/summary
   * Returns total/present/absent and avg % for a class.
   */
  @Get('classes/:id/summary')
  getClassSummary(@Param('id') classId: string) {
    return this.svc.getClassSummary(classId);
  }

  /**
   * GET /api/attendance/classes/:id/at-risk
   * Students below 75% threshold in this class — for teacher call panel.
   */
  @Get('classes/:id/at-risk')
  getClassAtRisk(@Param('id') classId: string) {
    return this.svc.getClassAtRisk(classId);
  }

  /**
   * GET /api/attendance/students/:usn/vtu-eligibility
   * Returns per-subject attendance and VTU eligibility (>=75%).
   */
  @Get('students/:usn/vtu-eligibility')
  getVtuEligibility(@Param('usn') usn: string) {
    return this.svc.getVtuEligibility(usn);
  }

  /**
   * POST /api/attendance/escalation/run
   * Manually trigger the escalation engine (usually runs via cron).
   */
  @Post('escalation/run')
  runEscalation() {
    return this.svc.runEscalationEngine();
  }

  @Put('records/:id/excuse')
  excuseAbsence(@Param('id') recordId: string, @Body() dto: ExcuseAbsenceDto) {
    return this.svc.excuseAbsence(recordId, dto.reason);
  }
}
