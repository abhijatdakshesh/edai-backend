import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AttendanceApiService } from './attendance-api.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsGateway } from '../events/events.gateway';

@UseGuards(JwtAuthGuard)
@Controller()
export class AttendanceApiController {
  constructor(
    private readonly svc: AttendanceApiService,
    private readonly events: EventsGateway,
  ) {}

  /** Student portal — per-course attendance with canMiss / mustAttend */
  @Get('attendance/student/:usn/summary')
  getStudentAttendanceSummary(@Param('usn') usn: string) {
    return this.svc.getStudentAttendanceSummary(usn);
  }

  /** Legacy / internal — overall + subject breakdown */
  @Get('attendance/student/:usn')
  getStudentAttendance(@Param('usn') usn: string) {
    return this.svc.getStudentAttendance(usn);
  }

  /** Teacher portal — present/absent/late counts for a class */
  @Get('attendance/class/:classId/summary')
  getClassAttendanceSummary(@Param('classId') classId: string) {
    return this.svc.getClassAttendanceSummary(classId);
  }

  /** Teacher / admin — students below 75% for a given class */
  @Get('attendance/class/:classId/at-risk')
  getAtRiskStudents(@Param('classId') classId: string) {
    return this.svc.getAtRiskStudents(classId);
  }

  /** Teacher portal mark-attendance — /api/attendance/bulk */
  @Post('attendance/bulk')
  markBulkAlt(
    @Body()
    body: {
      classId: string;
      date: string;
      entries: Array<{ studentUsn: string; status: 'PRESENT' | 'ABSENT' | 'LATE' }>;
    },
    @Request() req: any,
  ) {
    const markedBy = req.user?.sub ?? 'unknown';
    const mapped = body.entries.map((e) => ({
      usn: e.studentUsn,
      status: (e.status === 'PRESENT' ? 'P' : e.status === 'LATE' ? 'L' : 'A') as 'P' | 'A' | 'L',
    }));
    const result = this.svc.markBulk(body.classId, body.date, mapped, markedBy);
    this.events.emitAttendanceUpdate({ classId: body.classId, date: body.date });
    return result;
  }

  @Post('attendance')
  markBulk(
    @Body()
    body: {
      classId: string;
      date: string;
      records: Array<{ usn: string; status: 'P' | 'A' | 'L' }>;
    },
    @Request() req: any,
  ) {
    const markedBy = req.user?.sub ?? 'unknown';
    const result = this.svc.markBulk(
      body.classId,
      body.date,
      body.records,
      markedBy,
    );
    this.events.emitAttendanceUpdate({ classId: body.classId, date: body.date });
    return result;
  }

  @Get('teacher/attendance/summary')
  getTeacherSummary(@Request() req: any) {
    const teacherId = req.user?.sub ?? 'unknown';
    return this.svc.getTeacherSummary(teacherId);
  }

  @Get('teacher/classes/:id/students')
  getClassStudents(@Param('id') id: string) {
    return this.svc.getClassStudents(id);
  }

  @Get('admin/attendance/audit')
  getAuditLog() {
    return this.svc.getAuditLog();
  }

  @Put('admin/attendance/audit/:id')
  correctRecord(
    @Param('id') id: string,
    @Body() body: { status: 'P' | 'A' | 'L' },
    @Request() req: any,
  ) {
    const editedBy = req.user?.sub ?? 'unknown';
    return this.svc.correctRecord(id, body.status, editedBy);
  }
}
