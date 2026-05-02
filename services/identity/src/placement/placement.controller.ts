import {
  Controller, Get, Post, Body, Param, Query, Req, Res,
  UseGuards, HttpStatus, Logger, NotFoundException, InternalServerErrorException, Optional,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { PlacementScoreService } from './placement-score.service';
import { PlacementMatchingService } from './placement-matching.service';
import { PlacementResumeService } from './placement-resume.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface AddCompanyDto {
  name: string;
  industry: string;
  roleOffered: string;
  ctcLpa: number;
  minCgpa: number;
  eligibleBranches: string[];
  eligibleSemesters: number[];
  requiredSkills: string[];
  companyType: string;
  driveDate: string;
}

interface RecordOfferDto {
  studentUsn: string;
  companyId: string;
  ctcLpa: number;
  role: string;
  offerDate: string;
}

interface GenerateResumeDto {
  companyType: 'PRODUCT' | 'SERVICE' | 'STARTUP' | 'CORE';
}

const VALID_COMPANY_TYPES = new Set(['PRODUCT', 'SERVICE', 'STARTUP', 'CORE']);
const MAX_LIMIT = 200;

@Controller('placement')
@UseGuards(JwtAuthGuard)
export class PlacementController {
  private readonly logger = new Logger(PlacementController.name);

  constructor(
    private scoreService: PlacementScoreService,
    private matchingService: PlacementMatchingService,
    private resumeService: PlacementResumeService,
    @Optional() @InjectDataSource() private dataSource: DataSource,
  ) {}

  // ── Student endpoints ── role-gated to prevent IDOR (DPDP Act 2023)

  @Get('student/:usn')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT')
  getStudentProfile(
    @Param('usn') usn: string,
    @Req() req: { user: { role?: string; id?: string } },
  ) {
    // STUDENT role can only access their own profile
    if (req.user?.role === 'STUDENT' && req.user?.id !== usn) {
      throw new NotFoundException('Profile not found');
    }
    return this.scoreService.getStudentProfile(usn);
  }

  @Get('student/:usn/matches')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT')
  getStudentMatches(
    @Param('usn') usn: string,
    @Req() req: { user: { role?: string; id?: string } },
  ) {
    if (req.user?.role === 'STUDENT' && req.user?.id !== usn) {
      throw new NotFoundException('Matches not found');
    }
    return this.matchingService.getMatchesForStudent(usn);
  }

  @Post('student/:usn/resume')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD', 'STUDENT')
  async generateResume(
    @Param('usn') usn: string,
    @Body() body: GenerateResumeDto,
    @Req() req: { user: { role?: string; id?: string } },
    @Res() res: Response,
  ) {
    // Ownership check: students can only generate their own resume
    if (req.user?.role === 'STUDENT' && req.user?.id !== usn) {
      throw new NotFoundException('Student not found');
    }
    const companyType = VALID_COMPANY_TYPES.has(body.companyType) ? body.companyType : 'SERVICE';
    try {
      const pdfBuffer = await this.resumeService.generateResume(usn, companyType as GenerateResumeDto['companyType']);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${usn}_resume_${companyType}.pdf"`,
      });
      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (err) {
      this.logger.error('Resume generation failed', err);
      // Never leak internal error details (OWASP A05 / DPDP)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Resume generation failed. Please try again.' });
      }
    }
  }

  // ── Dashboard endpoints — admin/placement staff only ──

  @Get('dashboard/summary')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD', 'FACULTY')
  getDashboardSummary(
    @Query('department') department: string,
    @Query('semester') semester: string,
  ) {
    return this.scoreService.getDepartmentSummary(department || undefined, semester ? +semester : undefined);
  }

  @Get('dashboard/top-students')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD', 'FACULTY')
  getTopStudents(
    @Query('department') department: string,
    @Query('semester') semester: string,
    @Query('limit') limit: string,
  ) {
    const safeLimit = Math.min(Math.max(1, +limit || 20), MAX_LIMIT);
    return this.scoreService.getTopStudents(department, +semester || 8, safeLimit);
  }

  @Get('dashboard/ready')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD')
  getReadyStudents(@Query('minScore') minScore: string) {
    return this.scoreService.getAllReadyStudents(+minScore || 60);
  }

  // ── Company endpoints ──

  @Get('companies')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT')
  getCompanies() {
    return this.dataSource.query(`
      SELECT pc.id, pc.name, pc.industry, pc.role_offered, pc.ctc_lpa,
             pc.min_cgpa, pc.eligible_branches, pc.eligible_semesters,
             pc.required_skills, pc.company_type, pc.drive_date,
             COUNT(pm.id) as matched_students,
             COUNT(po.id) as offers_made
      FROM placement_companies pc
      LEFT JOIN placement_matches pm ON pm.company_id = pc.id
      LEFT JOIN placement_offers po ON po.company_id = pc.id
      WHERE pc.active = true
      GROUP BY pc.id
      ORDER BY pc.drive_date ASC NULLS LAST
    `);
  }

  @Post('companies')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL')
  addCompany(@Body() body: AddCompanyDto) {
    return this.dataSource.query(`
      INSERT INTO placement_companies
        (name, industry, role_offered, ctc_lpa, min_cgpa, eligible_branches,
         eligible_semesters, required_skills, company_type, drive_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `, [
      body.name, body.industry, body.roleOffered, body.ctcLpa, body.minCgpa,
      body.eligibleBranches, body.eligibleSemesters, body.requiredSkills,
      body.companyType, body.driveDate,
    ]);
  }

  @Post('companies/:id/match')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD')
  async runMatching(@Param('id') id: string) {
    const count = await this.matchingService.matchStudentsToCompany(id);
    return { matched: count };
  }

  @Get('companies/:id/students')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD', 'FACULTY')
  getCompanyStudents(@Param('id') id: string, @Query('limit') limit: string) {
    const safeLimit = Math.min(Math.max(1, +limit || 15), MAX_LIMIT);
    return this.matchingService.getTopStudentsForCompany(id, safeLimit);
  }

  @Post('offers')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD')
  async recordOffer(@Body() body: RecordOfferDto) {
    const result = await this.dataSource.query(`
      INSERT INTO placement_offers (student_usn, company_id, ctc_lpa, role, offer_date)
      VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [body.studentUsn, body.companyId, body.ctcLpa, body.role, body.offerDate]);
    await this.dataSource.query(`
      UPDATE placement_matches SET status = 'OFFERED'
      WHERE student_usn = $1 AND company_id = $2
    `, [body.studentUsn, body.companyId]);
    return result[0];
  }

  @Get('analytics/offers')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'PRINCIPAL', 'HOD')
  getOffersAnalytics(@Query('department') dept: string) {
    return this.dataSource.query(`
      SELECT
        s.department,
        COUNT(po.id) as total_offers,
        ROUND(AVG(po.ctc_lpa), 2) as avg_ctc,
        MAX(po.ctc_lpa) as highest_ctc,
        MIN(po.ctc_lpa) as lowest_ctc,
        COUNT(DISTINCT s.student_id) as students_placed
      FROM placement_offers po
      JOIN students s ON s.student_id = po.student_usn
      ${dept ? 'WHERE s.department = $1' : ''}
      GROUP BY s.department
      ORDER BY total_offers DESC
    `, dept ? [dept] : []);
  }
}
