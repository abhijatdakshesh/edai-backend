import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParentsService } from './parents.service';
import { LinkStudentDto } from '../dto/auth.dto';

@Controller('parents')
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('link-student')
  @HttpCode(HttpStatus.OK)
  linkStudent(@Body() dto: LinkStudentDto): { linked: boolean } {
    return this.parentsService.linkStudent(dto.parentId, dto.studentId, dto.otp);
  }
}
