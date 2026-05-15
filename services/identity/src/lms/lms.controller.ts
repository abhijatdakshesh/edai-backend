import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { LmsService } from './lms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('lms')
export class LmsController {
  constructor(private readonly svc: LmsService) {}

  // ── Modules ──────────────────────────────────────────────────────────────

  @Get('modules')
  async listModules(@Query('courseId') courseId: string) {
    if (!courseId) throw new BadRequestException('courseId required');
    return this.svc.listModules(courseId);
  }

  @Post('modules')
  async createModule(
    @Body() body: { courseId: string; title: string; description?: string; order?: number; published?: boolean },
  ) {
    return this.svc.createModule(body);
  }

  // ── Lessons ──────────────────────────────────────────────────────────────

  @Get('modules/:moduleId/lessons')
  async listLessons(@Param('moduleId') moduleId: string) {
    return this.svc.listLessons(moduleId);
  }

  @Get('lessons/:id')
  async getLesson(@Param('id') id: string, @Request() req: any) {
    const usn = req.user?.sub ?? req.user?.usn;
    const lesson = await this.svc.getLesson(id, usn);
    if (!lesson) throw new NotFoundException(`Lesson ${id} not found`);
    return lesson;
  }

  @Post('lessons')
  async createLesson(@Body() body: any) {
    return this.svc.createLesson(body);
  }

  @Patch('lessons/:id')
  async updateLesson(@Param('id') id: string, @Body() body: any) {
    const updated = await this.svc.updateLesson(id, body);
    if (!updated) throw new NotFoundException(`Lesson ${id} not found`);
    return updated;
  }

  // ── Progress + Mastery ───────────────────────────────────────────────────

  @Post('lessons/:id/checkpoint')
  async submitCheckpoint(
    @Param('id') lessonId: string,
    @Body() body: { answers: number[] },
    @Request() req: any,
  ) {
    const usn = req.user?.sub ?? req.user?.usn;
    if (!usn) throw new BadRequestException('USN missing from token');
    const lesson = await this.svc.getLesson(lessonId);
    if (!lesson) throw new NotFoundException();
    const total = lesson.checkpoint.length;
    let score = 0;
    for (let i = 0; i < total; i++) {
      if (body.answers?.[i] === lesson.checkpoint[i]?.correctIndex) score += 1;
    }
    const prog = await this.svc.recordCheckpoint(usn, lessonId, score, total);
    return { score, total, state: prog.state };
  }

  @Get('progress')
  async getProgress(@Query('courseId') courseId: string, @Request() req: any) {
    const usn = req.user?.sub ?? req.user?.usn;
    if (!courseId || !usn) throw new BadRequestException('courseId + usn required');
    return this.svc.listProgressForCourse(usn, courseId);
  }

  @Get('mastery')
  async getMastery(@Query('courseId') courseId: string, @Request() req: any) {
    const usn = req.user?.sub ?? req.user?.usn;
    if (!courseId || !usn) throw new BadRequestException('courseId + usn required');
    return this.svc.getMastery(usn, courseId);
  }

  // ── AI features ──────────────────────────────────────────────────────────

  @Post('lessons/:id/eli5')
  async eli5(
    @Param('id') id: string,
    @Body() body: { level: 'beginner' | 'intermediate' | 'advanced' },
  ) {
    const level = body?.level ?? 'beginner';
    const text = await this.svc.rewriteAtLevel(id, level);
    return { markdown: text, level };
  }

  @Post('authoring/draft')
  async authoringDraft(@Body() body: { courseId: string; syllabus: string }) {
    if (!body?.courseId || !body?.syllabus) throw new BadRequestException('courseId + syllabus required');
    return this.svc.draftModuleFromSyllabus(body.courseId, body.syllabus);
  }
}
