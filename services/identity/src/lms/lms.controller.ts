import {
  Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards,
  BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { LmsService } from './lms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { resolveCollegeId, getCollegeFeatures } from './tenant-context';

/**
 * All endpoints are tenant-scoped via `resolveCollegeId(req)`. Once Postgres
 * RLS is wired (proposal §3) the policy filters by `current_setting(...)`
 * inside the DB, but the application layer still resolves and asserts the
 * tenant defensively so a misconfigured RLS rule cannot silently leak.
 */
@UseGuards(JwtAuthGuard)
@Controller('lms')
export class LmsController {
  constructor(private readonly svc: LmsService) {}

  private requireFeature(collegeId: string, flag: string): void {
    const features = getCollegeFeatures(collegeId);
    if (features[flag] === false) {
      throw new ForbiddenException(`Feature '${flag}' is disabled for this college`);
    }
  }

  // ── Modules ──────────────────────────────────────────────────────────────

  @Get('modules')
  async listModules(@Query('courseId') courseId: string, @Request() req: any) {
    if (!courseId) throw new BadRequestException('courseId required');
    const collegeId = resolveCollegeId(req);
    return this.svc.listModules(collegeId, courseId);
  }

  @Post('modules')
  async createModule(
    @Body() body: { courseId: string; title: string; description?: string; order?: number; published?: boolean },
    @Request() req: any,
  ) {
    const collegeId = resolveCollegeId(req);
    return this.svc.createModule(collegeId, body);
  }

  // ── Lessons ──────────────────────────────────────────────────────────────

  @Get('modules/:moduleId/lessons')
  async listLessons(@Param('moduleId') moduleId: string, @Request() req: any) {
    const collegeId = resolveCollegeId(req);
    return this.svc.listLessons(collegeId, moduleId);
  }

  @Get('lessons/:id')
  async getLesson(@Param('id') id: string, @Request() req: any) {
    const collegeId = resolveCollegeId(req);
    const usn = req.user?.sub ?? req.user?.usn;
    const lesson = await this.svc.getLesson(collegeId, id, usn);
    if (!lesson) throw new NotFoundException(`Lesson ${id} not found`);
    return lesson;
  }

  @Post('lessons')
  async createLesson(@Body() body: any, @Request() req: any) {
    const collegeId = resolveCollegeId(req);
    return this.svc.createLesson(collegeId, body);
  }

  @Patch('lessons/:id')
  async updateLesson(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const collegeId = resolveCollegeId(req);
    const updated = await this.svc.updateLesson(collegeId, id, body);
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
    const collegeId = resolveCollegeId(req);
    const usn = req.user?.sub ?? req.user?.usn;
    if (!usn) throw new BadRequestException('USN missing from token');
    const lesson = await this.svc.getLesson(collegeId, lessonId);
    if (!lesson) throw new NotFoundException();
    const total = lesson.checkpoint.length;
    let score = 0;
    for (let i = 0; i < total; i++) {
      if (body.answers?.[i] === lesson.checkpoint[i]?.correctIndex) score += 1;
    }
    const prog = await this.svc.recordCheckpoint(collegeId, usn, lessonId, score, total);
    return { score, total, state: prog.state };
  }

  @Get('progress')
  async getProgress(@Query('courseId') courseId: string, @Request() req: any) {
    const collegeId = resolveCollegeId(req);
    const usn = req.user?.sub ?? req.user?.usn;
    if (!courseId || !usn) throw new BadRequestException('courseId + usn required');
    return this.svc.listProgressForCourse(collegeId, usn, courseId);
  }

  @Get('mastery')
  async getMastery(@Query('courseId') courseId: string, @Request() req: any) {
    const collegeId = resolveCollegeId(req);
    const usn = req.user?.sub ?? req.user?.usn;
    if (!courseId || !usn) throw new BadRequestException('courseId + usn required');
    return this.svc.getMastery(collegeId, usn, courseId);
  }

  // ── AI features ──────────────────────────────────────────────────────────

  @Post('lessons/:id/eli5')
  async eli5(
    @Param('id') id: string,
    @Body() body: { level: 'beginner' | 'intermediate' | 'advanced' },
    @Request() req: any,
  ) {
    const collegeId = resolveCollegeId(req);
    const level = body?.level ?? 'beginner';
    const text = await this.svc.rewriteAtLevel(collegeId, id, level);
    return { markdown: text, level };
  }

  @Post('authoring/draft')
  async authoringDraft(
    @Body() body: { courseId: string; syllabus: string },
    @Request() req: any,
  ) {
    if (!body?.courseId || !body?.syllabus) throw new BadRequestException('courseId + syllabus required');
    const collegeId = resolveCollegeId(req);
    this.requireFeature(collegeId, 'lms_assignments');
    return this.svc.draftModuleFromSyllabus(collegeId, body.courseId, body.syllabus);
  }

  // ── Tenant introspection ─────────────────────────────────────────────────

  @Get('features')
  async getFeatures(@Request() req: any) {
    const collegeId = resolveCollegeId(req);
    return { collegeId, features: getCollegeFeatures(collegeId) };
  }
}
