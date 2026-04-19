import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto, GradeSubmissionDto, SubmitAssignmentDto } from '../dto/assignments.dto';

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly svc: AssignmentsService) {}

  @Post()
  create(@Body() dto: CreateAssignmentDto) {
    return this.svc.create(dto);
  }

  @Get('class/:classId')
  listByClass(@Param('classId') classId: string) {
    return this.svc.listByClass(classId);
  }

  @Get('student/:studentId')
  listByStudent(@Param('studentId') studentId: string) {
    return this.svc.listByStudent(studentId);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() dto: SubmitAssignmentDto) {
    return this.svc.submit(id, dto);
  }

  @Put('submissions/:id/grade')
  grade(@Param('id') id: string, @Body() dto: GradeSubmissionDto) {
    return this.svc.grade(id, dto);
  }

  @Get(':id/summary')
  summary(@Param('id') id: string) {
    return this.svc.getSummary(id);
  }
}
