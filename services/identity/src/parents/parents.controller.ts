import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ParentsService } from './parents.service';
import { LinkStudentDto } from '../dto/auth.dto';

@Controller('parents')
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Post('link-student')
  @HttpCode(HttpStatus.OK)
  linkStudent(@Body() dto: LinkStudentDto): { linked: boolean } {
    return this.parentsService.linkStudent(dto.parentId, dto.studentId, dto.otp);
  }
}
