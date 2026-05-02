import {
  Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RecruiterService, type PostJobDto, type CandidateFilter } from './recruiter.service';

interface RecruiterRequest { user: { id: string; institutionId: string; role: string } }

@Controller('recruiter')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('RECRUITER')
export class RecruiterController {
  constructor(private readonly svc: RecruiterService) {}

  // ── Job management ────────────────────────────────────────────────────────

  @Post('jobs')
  postJob(@Req() req: RecruiterRequest, @Body() body: PostJobDto) {
    return this.svc.postJob(req.user.id, req.user.institutionId, body);
  }

  @Get('jobs')
  listJobs(@Req() req: RecruiterRequest) {
    return this.svc.listMyJobs(req.user.id);
  }

  @Get('jobs/:id')
  getJob(@Req() req: RecruiterRequest, @Param('id') id: string) {
    return this.svc.getJob(id, req.user.id);
  }

  @Put('jobs/:id/close')
  closeJob(@Req() req: RecruiterRequest, @Param('id') id: string) {
    return this.svc.closeJob(id, req.user.id);
  }

  // ── Applicant management ──────────────────────────────────────────────────

  @Get('jobs/:id/applicants')
  getApplicants(@Req() req: RecruiterRequest, @Param('id') id: string) {
    return this.svc.getApplicants(id, req.user.id);
  }

  @Put('jobs/:jobId/applicants/:usn/status')
  updateStatus(
    @Req() req: RecruiterRequest,
    @Param('jobId') jobId: string,
    @Param('usn') usn: string,
    @Body('status') status: 'SHORTLISTED' | 'INTERVIEW' | 'OFFERED' | 'REJECTED',
  ) {
    return this.svc.updateApplicationStatus(jobId, req.user.id, usn, status);
  }

  @Post('jobs/:id/shortlist')
  bulkShortlist(
    @Req() req: RecruiterRequest,
    @Param('id') id: string,
    @Body('studentUsns') studentUsns: string[],
  ) {
    return this.svc.bulkShortlist(id, req.user.id, studentUsns);
  }

  // ── Candidate search ──────────────────────────────────────────────────────

  @Get('candidates')
  searchCandidates(
    @Req() req: RecruiterRequest,
    @Query('branch') branch?: string,
    @Query('semester') semester?: string,
    @Query('minCgpa') minCgpa?: string,
    @Query('minScore') minScore?: string,
    @Query('skills') skills?: string,
    @Query('limit') limit?: string,
  ) {
    const filter: CandidateFilter = {
      branch: branch || undefined,
      semester: semester ? +semester : undefined,
      minCgpa: minCgpa ? +minCgpa : undefined,
      minPlacementScore: minScore ? +minScore : undefined,
      skills: skills ? skills.split(',').map(s => s.trim()) : undefined,
      limit: limit ? +limit : 50,
    };
    return this.svc.searchCandidates(req.user.institutionId, filter);
  }

  // ── AI: Existing endpoints ────────────────────────────────────────────────

  @Post('jobs/:id/ai/rank')
  aiRankCandidates(@Req() req: RecruiterRequest, @Param('id') id: string) {
    return this.svc.aiRankCandidates(id, req.user.id);
  }

  @Post('ai/generate-jd')
  aiGenerateJd(
    @Body() body: {
      roleTitle: string;
      companyName: string;
      roleType: string;
      requiredSkills: string[];
      ctcLpa: number;
    },
  ) {
    return this.svc.aiGenerateJd(body);
  }

  @Post('ai/interview-questions')
  aiInterviewQuestions(
    @Body() body: {
      roleTitle: string;
      roleType: string;
      requiredSkills: string[];
      round: 'APTITUDE' | 'TECHNICAL' | 'HR';
    },
  ) {
    return this.svc.aiInterviewQuestions(body);
  }

  @Post('candidates/ai-search')
  aiCandidateSearch(
    @Req() req: RecruiterRequest,
    @Body('query') query: string,
  ) {
    return this.svc.aiCandidateSearch(req.user.institutionId, query);
  }

  // ── AI: New endpoints ─────────────────────────────────────────────────────

  @Post('ai/semantic-match')
  aiSemanticMatch(@Req() req: RecruiterRequest, @Body('jdText') jdText: string) {
    return this.svc.aiSemanticMatch(req.user.institutionId, jdText);
  }

  @Post('ai/look-alike')
  aiLookAlike(@Req() req: RecruiterRequest, @Body('usn') usn: string) {
    return this.svc.aiLookAlike(req.user.institutionId, usn);
  }

  @Post('ai/hidden-gems')
  aiHiddenGems(@Req() req: RecruiterRequest, @Body('filter') filter: CandidateFilter) {
    return this.svc.aiHiddenGems(req.user.institutionId, filter ?? {});
  }

  @Post('ai/skill-adjacency')
  aiSkillAdjacency(
    @Req() req: RecruiterRequest,
    @Body('targetSkill') targetSkill: string,
    @Body('location') location?: string,
  ) {
    return this.svc.aiSkillAdjacency(req.user.institutionId, targetSkill, location);
  }

  @Post('ai/jd-improve')
  aiJdImprove(@Body() body: { jdText: string; ctcLpa: number; minCgpa: number; location: string }) {
    return this.svc.aiJdImprove(body);
  }

  @Post('ai/inclusive-check')
  aiInclusiveCheck(@Body('jdText') jdText: string) {
    return this.svc.aiInclusiveCheck(jdText);
  }

  @Post('ai/salary-benchmark')
  aiSalaryBenchmark(
    @Body() body: { roleTitle: string; roleType: string; location: string; requiredSkills: string[] },
  ) {
    return this.svc.aiSalaryBenchmark(body);
  }

  @Post('jobs/:id/ai/offer-prediction')
  aiOfferPrediction(@Req() req: RecruiterRequest, @Param('id') id: string) {
    return this.svc.aiOfferPrediction(id, req.user.id);
  }

  @Post('ai/outreach')
  aiOutreach(
    @Req() req: RecruiterRequest,
    @Body() body: { jobId: string; candidates: Record<string, unknown>[]; channel: string },
  ) {
    return this.svc.aiOutreach(req.user.id, body);
  }

  @Post('ai/bias-audit')
  aiBiasAudit(
    @Req() req: RecruiterRequest,
    @Body() body: { shortlistedUsns: string[]; allApplicantUsns: string[] },
  ) {
    // Fix 2: pass institutionId so service can validate USN ownership
    return this.svc.aiBiasAudit(body.shortlistedUsns, body.allApplicantUsns, req.user.institutionId);
  }

  @Post('ai/diversity-nudge')
  aiDiversityNudge(
    @Req() req: RecruiterRequest,
    @Body('jobId') jobId: string,
    @Body('currentShortlist') currentShortlist: string[],
  ) {
    return this.svc.aiDiversityNudge(jobId, req.user.id, currentShortlist, req.user.institutionId);
  }

  @Get('analytics')
  getAnalytics(@Req() req: RecruiterRequest) {
    return this.svc.getAnalytics(req.user.id);
  }

  @Post('ai/nl-query')
  recruiterNlQuery(@Req() req: RecruiterRequest, @Body('query') query: string) {
    return this.svc.recruiterNlQuery(req.user.id, query);
  }
}
