import {
  Injectable,
  Logger,
  Optional,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { claudeGenerate, CLAUDE_SMART } from '../shared/claude-ai';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TimetableSubjectInput {
  subjectCode: string;
  subjectName: string;
  subjectType: 'THEORY' | 'LAB' | 'ELECTIVE';
  credits: number;
  hoursPerWeek: number;
  facultyName: string;
  facultyId?: string;
  requiresLab?: boolean;
}

export interface FacultyConstraintInput {
  facultyName: string;
  unavailableDay?: string;
  unavailablePeriod?: number;
  preferredMorning?: boolean;
}

export interface CreateConfigDto {
  department: string;
  semester: number;
  academicYear: string;
  sections: string[];
  workingDays?: string[];
  periodsPerDay?: number;
  periodDurationMinutes?: number;
  breakAfterPeriod?: number;
  createdBy?: string;
  subjects: TimetableSubjectInput[];
  facultyConstraints?: FacultyConstraintInput[];
}

export interface TimetableConfig {
  id: string;
  department: string;
  semester: number;
  academicYear: string;
  sections: string[];
  workingDays: string[];
  periodsPerDay: number;
  periodDurationMinutes: number;
  breakAfterPeriod: number;
  status: string;
  createdBy: string;
  createdAt: string;
  generatedAt: string | null;
  subjects?: TimetableSubjectRow[];
}

export interface TimetableSubjectRow {
  id: string;
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  credits: number;
  hoursPerWeek: number;
  facultyName: string;
  requiresLab: boolean;
}

export interface TimetableSlot {
  id: string;
  configId: string;
  section: string;
  day: string;
  period: number;
  subjectCode: string | null;
  subjectName: string | null;
  subjectType: string | null;
  facultyName: string | null;
  classroomId: string | null;
  classroomName: string | null;
  isBreak: boolean;
}

export interface TimetableConflict {
  id: string;
  configId: string;
  conflictType: string;
  description: string;
  day: string | null;
  period: number | null;
  affectedEntity: string | null;
  severity: string;
  createdAt: string;
}

export interface Classroom {
  id: string;
  name: string;
  building: string | null;
  capacity: number;
  type: string;
  isActive: boolean;
}

export interface GeneratedTimetable {
  configId: string;
  slots: TimetableSlot[];
  conflicts: TimetableConflict[];
  viewBySection: Record<string, Record<string, Record<number, TimetableSlot>>>;
  viewByFaculty: Record<string, TimetableSlot[]>;
  viewByClassroom: Record<string, TimetableSlot[]>;
  generatedAt: string;
}

interface GeminiSlot {
  section: string;
  day: string;
  period: number;
  subjectCode?: string;
  subjectName?: string;
  subjectType?: string;
  facultyName?: string;
  classroomName?: string;
  isBreak?: boolean;
}

interface GeminiConflict {
  conflictType: string;
  description: string;
  day?: string;
  period?: number;
  affectedEntity?: string;
  severity?: string;
}

interface GeminiTimetableResponse {
  slots: GeminiSlot[];
  conflicts?: GeminiConflict[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class TimetableService {
  private readonly logger = new Logger(TimetableService.name);

  constructor(
    @Optional() @InjectDataSource() private readonly db: DataSource | null,
  ) {}

  // ── createConfig ─────────────────────────────────────────────────────────

  async createConfig(dto: CreateConfigDto): Promise<TimetableConfig> {
    if (!this.db) throw new InternalServerErrorException('No database');

    const id = randomUUID();
    const workingDays = dto.workingDays ?? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const periodsPerDay = dto.periodsPerDay ?? 7;
    const periodDurationMinutes = dto.periodDurationMinutes ?? 55;
    const breakAfterPeriod = dto.breakAfterPeriod ?? 4;
    const createdBy = dto.createdBy ?? 'system';

    await this.db.query(
      `INSERT INTO timetable_configs
         (id, department, semester, academic_year, sections, working_days,
          periods_per_day, period_duration_minutes, break_after_period, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (department, semester, academic_year)
       DO UPDATE SET sections=$5, status='DRAFT', generated_at=NULL`,
      [id, dto.department, dto.semester, dto.academicYear,
       dto.sections, workingDays, periodsPerDay, periodDurationMinutes,
       breakAfterPeriod, createdBy],
    );

    // Delete and re-insert subjects
    await this.db.query(`DELETE FROM timetable_subjects WHERE config_id=$1`, [id]);
    for (const s of dto.subjects) {
      await this.db.query(
        `INSERT INTO timetable_subjects
           (id, config_id, subject_code, subject_name, subject_type, credits,
            hours_per_week, faculty_name, faculty_id, requires_lab)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [randomUUID(), id, s.subjectCode, s.subjectName,
         s.subjectType, s.credits, s.hoursPerWeek, s.facultyName,
         s.facultyId ?? null, s.requiresLab ?? false],
      );
    }

    // Insert faculty constraints if provided
    if (dto.facultyConstraints?.length) {
      await this.db.query(`DELETE FROM timetable_faculty_constraints WHERE config_id=$1`, [id]);
      for (const c of dto.facultyConstraints) {
        await this.db.query(
          `INSERT INTO timetable_faculty_constraints
             (id, config_id, faculty_name, unavailable_day, unavailable_period, preferred_morning)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT DO NOTHING`,
          [randomUUID(), id, c.facultyName, c.unavailableDay ?? null,
           c.unavailablePeriod ?? null, c.preferredMorning ?? false],
        );
      }
    }

    return this.getConfig(id);
  }

  // ── getConfig ─────────────────────────────────────────────────────────────

  async getConfig(configId: string): Promise<TimetableConfig> {
    if (!this.db) throw new InternalServerErrorException('No database');
    const rows = await this.db.query(
      `SELECT * FROM timetable_configs WHERE id=$1`, [configId],
    );
    if (!rows.length) throw new NotFoundException(`Timetable config ${configId} not found`);
    const subjects = await this.db.query(
      `SELECT * FROM timetable_subjects WHERE config_id=$1 ORDER BY subject_code`, [configId],
    );
    return this.mapConfig(rows[0] as Record<string, unknown>, subjects as Record<string, unknown>[]);
  }

  // ── listConfigs ───────────────────────────────────────────────────────────

  async listConfigs(department?: string): Promise<TimetableConfig[]> {
    if (!this.db) return [];
    const params: unknown[] = [];
    let q = `SELECT * FROM timetable_configs`;
    if (department) { q += ` WHERE department=$1`; params.push(department); }
    q += ` ORDER BY created_at DESC LIMIT 50`;
    const rows = await this.db.query(q, params) as Record<string, unknown>[];
    return rows.map(r => this.mapConfig(r, []));
  }

  // ── getClassrooms ─────────────────────────────────────────────────────────

  async getClassrooms(): Promise<Classroom[]> {
    if (!this.db) return [];
    const rows = await this.db.query(
      `SELECT * FROM classrooms WHERE is_active=TRUE ORDER BY name LIMIT 500`,
    ) as Record<string, unknown>[];
    return rows.map(r => ({
      id: r['id'] as string,
      name: r['name'] as string,
      building: r['building'] as string | null,
      capacity: Number(r['capacity']),
      type: r['type'] as string,
      isActive: Boolean(r['is_active']),
    }));
  }

  // ── getSlots ──────────────────────────────────────────────────────────────

  async getSlots(configId: string, section?: string): Promise<TimetableSlot[]> {
    if (!this.db) return [];
    const params: unknown[] = [configId];
    let q = `SELECT * FROM timetable_slots WHERE config_id=$1`;
    if (section) { q += ` AND section=$2`; params.push(section); }
    q += ` ORDER BY section, day, period`;
    const rows = await this.db.query(q, params) as Record<string, unknown>[];
    return rows.map(r => this.mapSlot(r));
  }

  // ── getConflicts ──────────────────────────────────────────────────────────

  async getConflicts(configId: string): Promise<TimetableConflict[]> {
    if (!this.db) return [];
    const rows = await this.db.query(
      `SELECT * FROM timetable_conflicts WHERE config_id=$1 ORDER BY severity DESC, created_at`,
      [configId],
    ) as Record<string, unknown>[];
    return rows.map(r => this.mapConflict(r));
  }

  // ── publishConfig ─────────────────────────────────────────────────────────

  async publishConfig(configId: string): Promise<TimetableConfig> {
    if (!this.db) throw new InternalServerErrorException('No database');
    await this.db.query(
      `UPDATE timetable_configs SET status='PUBLISHED' WHERE id=$1`, [configId],
    );
    return this.getConfig(configId);
  }

  // ── deleteConfig ──────────────────────────────────────────────────────────

  async deleteConfig(configId: string): Promise<void> {
    if (!this.db) throw new InternalServerErrorException('No database');
    await this.db.query(`DELETE FROM timetable_configs WHERE id=$1`, [configId]);
  }

  // ── generate ──────────────────────────────────────────────────────────────

  async generate(configId: string): Promise<GeneratedTimetable> {
    if (!this.db) throw new InternalServerErrorException('No database');

    const config = await this.getConfig(configId);
    const classrooms = await this.getClassrooms();
    const prompt = this.buildPrompt(config, classrooms);

    let rawJson: string;
    try {
      rawJson = await claudeGenerate(prompt, CLAUDE_SMART, 8192);
    } catch (err) {
      this.logger.error(`[Timetable] Claude failed for ${configId}: ${err instanceof Error ? err.message : String(err)}`);
      throw new InternalServerErrorException('AI timetable generation failed');
    }

    // Strip markdown fences Gemini sometimes adds despite instructions
    const jsonStr = rawJson
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsed: GeminiTimetableResponse;
    try {
      parsed = JSON.parse(jsonStr) as GeminiTimetableResponse;
    } catch {
      this.logger.error(`[Timetable] JSON parse failed. Raw: ${rawJson.slice(0, 500)}`);
      throw new InternalServerErrorException('AI returned malformed timetable JSON');
    }

    await this.persistSlots(configId, parsed.slots ?? [], classrooms);
    await this.persistConflicts(configId, parsed.conflicts ?? []);

    await this.db.query(
      `UPDATE timetable_configs SET status='GENERATED', generated_at=NOW() WHERE id=$1`,
      [configId],
    );

    this.logger.log(`[Timetable] Generated ${parsed.slots?.length ?? 0} slots, ${parsed.conflicts?.length ?? 0} conflicts for config ${configId}`);

    return this.buildViews(configId, parsed.slots ?? [], parsed.conflicts ?? []);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private buildPrompt(config: TimetableConfig, classrooms: Classroom[]): string {
    const lectureRooms = classrooms.filter(c => c.type === 'LECTURE').map(c => c.name).join(', ');
    const labRooms = classrooms.filter(c => c.type === 'LAB').map(c => c.name).join(', ');
    const subjects = config.subjects ?? [];

    return `You are an expert academic timetable scheduler for VTU-affiliated engineering colleges in India.
Generate a complete weekly timetable that strictly satisfies ALL 13 VTU scheduling rules below.
Return ONLY a raw JSON object — absolutely NO markdown code fences, NO explanation text, NO preamble.

=== 13 VTU SCHEDULING RULES ===
1. No faculty may be assigned to two different sections in the same period on the same day (FACULTY_CLASH).
2. No classroom may be used by two sections in the same period on the same day (ROOM_CLASH).
3. Lab subjects (subjectType=LAB) MUST occupy two consecutive periods. Both slots share same faculty, subject, and LAB classroom.
4. Each subject must receive EXACTLY its hoursPerWeek contact periods across the full week.
5. A subject must not appear more than once per day for the same section.
6. No faculty should teach more than 6 periods per day (MAX_DAILY_VIOLATION).
7. Honour faculty unavailableDay and unavailablePeriod constraints. Never schedule a faculty member during their unavailable slot.
8. Period ${config.breakAfterPeriod} is always a lunch break. Set isBreak=true with all subject/faculty/classroom fields omitted.
9. Saturday: schedule at most 4 periods (periods 1–4). Periods 5–7 on Saturday must be isBreak=true.
10. Distribute each subject evenly across the week — no subject should appear on the same day more than once per section.
11. THEORY subjects use LECTURE classrooms. LAB subjects use LAB classrooms.
12. If any constraint CANNOT be satisfied, add an entry to the conflicts array with the appropriate conflictType and severity. Do NOT silently break a rule.
13. Output: raw JSON object only — no markdown fences (\`\`\`), no explanation. The JSON must be parseable by JSON.parse() directly.

=== TIMETABLE INPUT ===
Department: ${config.department}
Semester: ${config.semester}
Academic Year: ${config.academicYear}
Sections: ${config.sections.join(', ')}
Working Days: ${config.workingDays.join(', ')}
Periods per Day: ${config.periodsPerDay}
Period Duration: ${config.periodDurationMinutes} minutes
Lunch Break: Period ${config.breakAfterPeriod}

Subjects to schedule:
${subjects.map(s =>
  `  - Code: ${s.subjectCode} | Name: ${s.subjectName} | Type: ${s.subjectType} | Credits: ${s.credits} | Hours/Week: ${s.hoursPerWeek} | Faculty: ${s.facultyName} | RequiresLab: ${s.requiresLab}`
).join('\n')}

Available classrooms:
  LECTURE rooms: ${lectureRooms || 'LH-101, LH-102, LH-103'}
  LAB rooms: ${labRooms || 'LAB-CS-A, LAB-CS-B'}

=== REQUIRED OUTPUT FORMAT ===
{
  "slots": [
    {
      "section": "A",
      "day": "MON",
      "period": 1,
      "subjectCode": "21CS51",
      "subjectName": "Machine Learning",
      "subjectType": "THEORY",
      "facultyName": "Dr. Sharma",
      "classroomName": "LH-101",
      "isBreak": false
    },
    {
      "section": "A",
      "day": "MON",
      "period": ${config.breakAfterPeriod},
      "isBreak": true
    }
  ],
  "conflicts": [
    {
      "conflictType": "FACULTY_CLASH",
      "description": "Dr. Sharma is assigned to both Section A and Section B on MON period 3",
      "day": "MON",
      "period": 3,
      "affectedEntity": "Dr. Sharma",
      "severity": "ERROR"
    }
  ]
}

Generate ALL slots for ALL sections (${config.sections.join(', ')}) across ALL working days (${config.workingDays.join(', ')}).
Every period for every section every day must have exactly one slot entry.
Total expected slot count: ${config.sections.length} sections × ${config.workingDays.length} days × ${config.periodsPerDay} periods = ${config.sections.length * config.workingDays.length * config.periodsPerDay} slots.
The conflicts array must be [] if the timetable is fully valid with zero constraint violations.`;
  }

  private async persistSlots(
    configId: string,
    geminiSlots: GeminiSlot[],
    classrooms: Classroom[],
  ): Promise<void> {
    await this.db!.query(`DELETE FROM timetable_slots WHERE config_id=$1`, [configId]);

    for (const s of geminiSlots) {
      const classroom = classrooms.find(c => c.name === s.classroomName);
      await this.db!.query(
        `INSERT INTO timetable_slots
           (id, config_id, section, day, period, subject_code, subject_name,
            subject_type, faculty_name, classroom_id, classroom_name, is_break)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (config_id, section, day, period) DO UPDATE
           SET subject_code=$6, subject_name=$7, subject_type=$8,
               faculty_name=$9, classroom_id=$10, classroom_name=$11, is_break=$12`,
        [randomUUID(), configId, s.section, s.day, s.period,
         s.subjectCode ?? null, s.subjectName ?? null, s.subjectType ?? null,
         s.facultyName ?? null, classroom?.id ?? null, s.classroomName ?? null,
         s.isBreak ?? false],
      );
    }
  }

  private async persistConflicts(
    configId: string,
    geminiConflicts: GeminiConflict[],
  ): Promise<void> {
    await this.db!.query(`DELETE FROM timetable_conflicts WHERE config_id=$1`, [configId]);

    for (const c of geminiConflicts) {
      await this.db!.query(
        `INSERT INTO timetable_conflicts
           (id, config_id, conflict_type, description, day, period, affected_entity, severity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [randomUUID(), configId, c.conflictType, c.description,
         c.day ?? null, c.period ?? null, c.affectedEntity ?? null,
         c.severity ?? 'ERROR'],
      );
    }
  }

  private buildViews(
    configId: string,
    geminiSlots: GeminiSlot[],
    geminiConflicts: GeminiConflict[],
  ): GeneratedTimetable {
    const slots: TimetableSlot[] = geminiSlots.map(s => ({
      id: randomUUID(),
      configId,
      section: s.section,
      day: s.day,
      period: s.period,
      subjectCode: s.subjectCode ?? null,
      subjectName: s.subjectName ?? null,
      subjectType: s.subjectType ?? null,
      facultyName: s.facultyName ?? null,
      classroomId: null,
      classroomName: s.classroomName ?? null,
      isBreak: s.isBreak ?? false,
    }));

    const conflicts: TimetableConflict[] = geminiConflicts.map(c => ({
      id: randomUUID(),
      configId,
      conflictType: c.conflictType,
      description: c.description,
      day: c.day ?? null,
      period: c.period ?? null,
      affectedEntity: c.affectedEntity ?? null,
      severity: c.severity ?? 'ERROR',
      createdAt: new Date().toISOString(),
    }));

    // viewBySection[section][day][period] = slot
    const viewBySection: Record<string, Record<string, Record<number, TimetableSlot>>> = {};
    for (const slot of slots) {
      if (!viewBySection[slot.section]) viewBySection[slot.section] = {};
      if (!viewBySection[slot.section][slot.day]) viewBySection[slot.section][slot.day] = {};
      viewBySection[slot.section][slot.day][slot.period] = slot;
    }

    // viewByFaculty[facultyName] = [slot, ...]
    const viewByFaculty: Record<string, TimetableSlot[]> = {};
    for (const slot of slots) {
      if (!slot.facultyName || slot.isBreak) continue;
      if (!viewByFaculty[slot.facultyName]) viewByFaculty[slot.facultyName] = [];
      viewByFaculty[slot.facultyName].push(slot);
    }

    // viewByClassroom[classroomName] = [slot, ...]
    const viewByClassroom: Record<string, TimetableSlot[]> = {};
    for (const slot of slots) {
      if (!slot.classroomName || slot.isBreak) continue;
      if (!viewByClassroom[slot.classroomName]) viewByClassroom[slot.classroomName] = [];
      viewByClassroom[slot.classroomName].push(slot);
    }

    return {
      configId,
      slots,
      conflicts,
      viewBySection,
      viewByFaculty,
      viewByClassroom,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Row mappers ───────────────────────────────────────────────────────────

  private mapConfig(r: Record<string, unknown>, subjects: Record<string, unknown>[]): TimetableConfig {
    return {
      id: r['id'] as string,
      department: r['department'] as string,
      semester: Number(r['semester']),
      academicYear: r['academic_year'] as string,
      sections: r['sections'] as string[],
      workingDays: r['working_days'] as string[],
      periodsPerDay: Number(r['periods_per_day']),
      periodDurationMinutes: Number(r['period_duration_minutes']),
      breakAfterPeriod: Number(r['break_after_period']),
      status: r['status'] as string,
      createdBy: r['created_by'] as string,
      createdAt: r['created_at'] as string,
      generatedAt: r['generated_at'] as string | null,
      subjects: subjects.map(s => ({
        id: s['id'] as string,
        subjectCode: s['subject_code'] as string,
        subjectName: s['subject_name'] as string,
        subjectType: s['subject_type'] as string,
        credits: Number(s['credits']),
        hoursPerWeek: Number(s['hours_per_week']),
        facultyName: s['faculty_name'] as string,
        requiresLab: Boolean(s['requires_lab']),
      })),
    };
  }

  private mapSlot(r: Record<string, unknown>): TimetableSlot {
    return {
      id: r['id'] as string,
      configId: r['config_id'] as string,
      section: r['section'] as string,
      day: r['day'] as string,
      period: Number(r['period']),
      subjectCode: r['subject_code'] as string | null,
      subjectName: r['subject_name'] as string | null,
      subjectType: r['subject_type'] as string | null,
      facultyName: r['faculty_name'] as string | null,
      classroomId: r['classroom_id'] as string | null,
      classroomName: r['classroom_name'] as string | null,
      isBreak: Boolean(r['is_break']),
    };
  }

  private mapConflict(r: Record<string, unknown>): TimetableConflict {
    return {
      id: r['id'] as string,
      configId: r['config_id'] as string,
      conflictType: r['conflict_type'] as string,
      description: r['description'] as string,
      day: r['day'] as string | null,
      period: r['period'] != null ? Number(r['period']) : null,
      affectedEntity: r['affected_entity'] as string | null,
      severity: r['severity'] as string,
      createdAt: r['created_at'] as string,
    };
  }
}
