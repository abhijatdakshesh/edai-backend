import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TimetableService, CreateConfigDto } from './timetable.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('timetable')
@UseGuards(JwtAuthGuard)
export class TimetableController {
  constructor(private readonly svc: TimetableService) {}

  @Post('configs')
  createConfig(@Body() dto: CreateConfigDto) {
    return this.svc.createConfig(dto);
  }

  @Get('configs')
  listConfigs(@Query('department') department?: string) {
    return this.svc.listConfigs(department);
  }

  @Get('configs/:id')
  getConfig(@Param('id') id: string) {
    return this.svc.getConfig(id);
  }

  @Delete('configs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConfig(@Param('id') id: string) {
    return this.svc.deleteConfig(id);
  }

  @Post('configs/:id/generate')
  generate(@Param('id') id: string) {
    return this.svc.generate(id);
  }

  @Post('configs/:id/publish')
  @HttpCode(HttpStatus.OK)
  publishConfig(@Param('id') id: string) {
    return this.svc.publishConfig(id);
  }

  @Get('configs/:id/slots')
  getSlots(@Param('id') id: string, @Query('section') section?: string) {
    return this.svc.getSlots(id, section);
  }

  @Get('configs/:id/conflicts')
  getConflicts(@Param('id') id: string) {
    return this.svc.getConflicts(id);
  }

  @Get('classrooms')
  getClassrooms() {
    return this.svc.getClassrooms();
  }
}
