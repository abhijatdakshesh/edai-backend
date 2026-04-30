import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import { PlacementScoreService, StudentPlacementProfile } from './placement-score.service';

const COMPANY_TYPE_CONTEXT: Record<string, string> = {
  PRODUCT: 'a product-based tech company. Emphasise problem-solving, DSA, system design thinking, projects with impact metrics.',
  SERVICE: 'a service-based IT company. Emphasise teamwork, adaptability, communication, and broad technical skills.',
  STARTUP: 'a startup. Emphasise initiative, learning agility, broad skill set, any side projects or hackathons.',
  CORE: 'a core engineering company. Emphasise domain knowledge, lab work, internships in the field.',
};

@Injectable()
export class PlacementResumeService {
  private readonly logger = new Logger(PlacementResumeService.name);
  private anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private scoreService: PlacementScoreService,
  ) {}

  async generateResume(usn: string, companyType: 'PRODUCT' | 'SERVICE' | 'STARTUP' | 'CORE'): Promise<Buffer> {
    const profile = await this.scoreService.getStudentProfile(usn);
    const student = await this.dataSource.query(`SELECT phone, email FROM students WHERE usn = $1`, [usn]);
    const contact = (student[0] ?? {}) as Record<string, unknown>;

    const subjectSummary = profile.subjects
      .map(s => `${s.name}: IA1=${s.ia1 ?? 'N/A'}, IA2=${s.ia2 ?? 'N/A'}, IA3=${s.ia3 ?? 'N/A'} (out of ${s.max})`)
      .join('\n');

    const claudePrompt = `You are writing a professional resume for a BE student applying to ${COMPANY_TYPE_CONTEXT[companyType]}

STUDENT DATA (use ONLY this — do not invent anything):
Name: ${profile.name} | USN: ${profile.usn} | Department: ${profile.department}
Semester: ${profile.semester} | College: RV Institute of Technology and Management, Bengaluru
CGPA: ${profile.cgpa}/10 | Attendance: ${profile.attendancePct}% | Backlogs: ${profile.backlogs}

Subject Performance:
${subjectSummary}

Write a complete resume with sections: OBJECTIVE, EDUCATION, TECHNICAL SKILLS, ACADEMIC PROJECTS, ACHIEVEMENTS, EXTRA-CURRICULAR.
For missing data write placeholders like "[Add your projects here]".
Format as clean plain text, section headers in CAPS, no markdown, no asterisks. 1 page of content.`;

    let resumeText = '';
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: claudePrompt }],
      });
      resumeText = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      this.logger.error('Claude resume error', err);
      resumeText = `OBJECTIVE\nSeeking a ${companyType.toLowerCase()} role.\n\nEDUCATION\nBE in ${profile.department}, RVITM Bengaluru — CGPA: ${profile.cgpa}/10`;
    }

    await this.dataSource.query(`
      INSERT INTO placement_resumes (student_usn, company_type, resume_text, version)
      VALUES ($1, $2, $3,
        COALESCE((SELECT MAX(version) + 1 FROM placement_resumes WHERE student_usn = $1 AND company_type = $2), 1))
    `, [usn, companyType, resumeText]);

    return this.buildResumePDF(profile, contact, resumeText, companyType);
  }

  private buildResumePDF(
    profile: StudentPlacementProfile,
    contact: Record<string, unknown>,
    resumeText: string,
    companyType: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(22).font('Helvetica-Bold').text(profile.name.toUpperCase(), { align: 'center' });
      doc.fontSize(10).font('Helvetica').fillColor('#1D4ED8')
        .text(`${profile.department} | Semester ${profile.semester} | RVITM, Bengaluru`, { align: 'center' });
      doc.fillColor('black').fontSize(9)
        .text(`USN: ${profile.usn}  |  ${String(contact['email'] ?? profile.usn.toLowerCase() + '@rvitm.edu.in')}  |  ${String(contact['phone'] ?? '')}`, { align: 'center' });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1D4ED8').lineWidth(2).stroke();
      doc.moveDown(0.5);

      for (const line of resumeText.split('\n')) {
        if (!line.trim()) { doc.moveDown(0.3); continue; }
        if (line === line.toUpperCase() && line.length > 2 && !line.includes('(')) {
          doc.moveDown(0.2);
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#1D4ED8').text(line);
          doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
          doc.moveDown(0.15);
        } else {
          doc.fontSize(10).font('Helvetica').fillColor('black').text(line);
        }
      }

      doc.fontSize(8).fillColor('#64748B')
        .text(`Generated by EdAI — ${new Date().toLocaleDateString('en-IN')} — ${companyType} profile`,
          50, 780, { align: 'center', width: 495 });
      doc.end();
    });
  }
}
