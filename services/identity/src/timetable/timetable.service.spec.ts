/**
 * timetable.service.spec.ts
 *
 * Unit tests for TimetableService.
 * Gemini SDK is fully mocked.  DataSource is injected as a mock.
 * Target: 100 % statements / branches / functions / lines.
 */

import { Test } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  TimetableService,
  CreateConfigDto,
  TimetableConfig,
  TimetableSlot,
} from './timetable.service';

// ─── Mock Claude AI ──────────────────────────────────────────────────────────

jest.mock('../shared/claude-ai', () => ({
  claudeGenerate: jest.fn(),
  CLAUDE_FAST: 'claude-haiku-4-5-20251001',
  CLAUDE_SMART: 'claude-sonnet-4-6',
}));
const mockClaudeGenerate = jest.requireMock('../shared/claude-ai').claudeGenerate as jest.Mock;

// ─── Mock DataSource ──────────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockDb = { query: mockQuery };

// ─── Service factory ──────────────────────────────────────────────────────────

async function buildService(withDb = true): Promise<TimetableService> {
  const module = await Test.createTestingModule({
    providers: [
      TimetableService,
      withDb ? { provide: getDataSourceToken(), useValue: mockDb } : [],
    ].flat(),
  }).compile();
  return module.get<TimetableService>(TimetableService);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONFIG_ID = 'cfg-uuid-1234';

/** Raw DB row returned by SELECT * FROM timetable_configs */
const rawConfigRow = {
  id: CONFIG_ID,
  department: 'CSE',
  semester: 5,
  academic_year: '2024-25',
  sections: ['A', 'B'],
  working_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  periods_per_day: 7,
  period_duration_minutes: 55,
  break_after_period: 4,
  status: 'DRAFT',
  created_by: 'admin',
  created_at: '2024-01-01T00:00:00Z',
  generated_at: null,
};

/** Raw DB row returned by SELECT * FROM timetable_subjects */
const rawSubjectRow = {
  id: 'sub-uuid-1',
  subject_code: '21CS51',
  subject_name: 'Machine Learning',
  subject_type: 'THEORY',
  credits: 3,
  hours_per_week: 4,
  faculty_name: 'Dr. Sharma',
  requires_lab: false,
};

/** Raw DB row for classrooms */
const rawClassroomRow = {
  id: 'room-uuid-1',
  name: 'LH-101',
  building: 'Block A',
  capacity: 60,
  type: 'LECTURE',
  is_active: true,
};

/** Minimal valid Gemini JSON — 1 slot, 0 conflicts */
const geminiSlot = {
  section: 'A',
  day: 'MON',
  period: 1,
  subjectCode: '21CS51',
  subjectName: 'Machine Learning',
  subjectType: 'THEORY',
  facultyName: 'Dr. Sharma',
  classroomName: 'LH-101',
  isBreak: false,
};
const minimalGeminiJson = JSON.stringify({ slots: [geminiSlot], conflicts: [] });

/** A minimal CreateConfigDto */
const baseDto: CreateConfigDto = {
  department: 'CSE',
  semester: 5,
  academicYear: '2024-25',
  sections: ['A'],
  subjects: [
    {
      subjectCode: '21CS51',
      subjectName: 'Machine Learning',
      subjectType: 'THEORY',
      credits: 3,
      hoursPerWeek: 4,
      facultyName: 'Dr. Sharma',
    },
  ],
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('TimetableService', () => {
  let svc: TimetableService;

  beforeEach(async () => {
    jest.clearAllMocks();
    svc = await buildService(true);
  });

  // ── createConfig ────────────────────────────────────────────────────────────

  describe('createConfig()', () => {
    it('inserts config + subjects and returns mapped config', async () => {
      // INSERT config (query 1), DELETE subjects (query 2), INSERT subject (query 3)
      // Then getConfig → SELECT config (query 4), SELECT subjects (query 5)
      mockQuery
        .mockResolvedValueOnce([]) // INSERT config
        .mockResolvedValueOnce([]) // DELETE subjects
        .mockResolvedValueOnce([]) // INSERT subject
        .mockResolvedValueOnce([rawConfigRow]) // SELECT config
        .mockResolvedValueOnce([rawSubjectRow]); // SELECT subjects

      const result = await svc.createConfig(baseDto);

      // 5 queries total: INSERT, DELETE, INSERT, SELECT, SELECT
      expect(mockQuery).toHaveBeenCalledTimes(5);
      expect(result.department).toBe('CSE');
      expect(result.semester).toBe(5);
      expect(result.subjects).toHaveLength(1);
      expect(result.subjects![0].subjectCode).toBe('21CS51');
    });

    it('handles facultyConstraints when provided with all optional fields', async () => {
      const dto: CreateConfigDto = {
        ...baseDto,
        facultyConstraints: [
          { facultyName: 'Dr. Sharma', unavailableDay: 'MON', preferredMorning: true },
        ],
      };
      mockQuery
        .mockResolvedValueOnce([]) // INSERT config
        .mockResolvedValueOnce([]) // DELETE subjects
        .mockResolvedValueOnce([]) // INSERT subject
        .mockResolvedValueOnce([]) // DELETE constraints
        .mockResolvedValueOnce([]) // INSERT constraint
        .mockResolvedValueOnce([rawConfigRow]) // SELECT config
        .mockResolvedValueOnce([rawSubjectRow]); // SELECT subjects

      const result = await svc.createConfig(dto);

      expect(mockQuery).toHaveBeenCalledTimes(7);
      expect(result.department).toBe('CSE');
    });

    it('uses null defaults for omitted optional constraint fields (covers ?? branches on lines 205-206)', async () => {
      // unavailableDay, unavailablePeriod, preferredMorning all omitted
      const dto: CreateConfigDto = {
        ...baseDto,
        facultyConstraints: [{ facultyName: 'Dr. Sharma' }],
      };
      mockQuery
        .mockResolvedValueOnce([]) // INSERT config
        .mockResolvedValueOnce([]) // DELETE subjects
        .mockResolvedValueOnce([]) // INSERT subject
        .mockResolvedValueOnce([]) // DELETE constraints
        .mockResolvedValueOnce([]) // INSERT constraint
        .mockResolvedValueOnce([rawConfigRow]) // SELECT config
        .mockResolvedValueOnce([rawSubjectRow]); // SELECT subjects

      await svc.createConfig(dto);

      // INSERT constraint call is index 4
      const constraintInsertCall = mockQuery.mock.calls[4];
      const params = constraintInsertCall[1] as unknown[];
      expect(params[3]).toBeNull();   // unavailableDay ?? null
      expect(params[4]).toBeNull();   // unavailablePeriod ?? null
      expect(params[5]).toBe(false);  // preferredMorning ?? false
    });

    it('throws InternalServerErrorException when db is null', async () => {
      const noDb = await buildService(false);
      await expect(noDb.createConfig(baseDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── getConfig ───────────────────────────────────────────────────────────────

  describe('getConfig()', () => {
    it('returns mapped config when row found', async () => {
      mockQuery
        .mockResolvedValueOnce([rawConfigRow]) // SELECT config
        .mockResolvedValueOnce([rawSubjectRow]); // SELECT subjects

      const result = await svc.getConfig(CONFIG_ID);

      expect(result.id).toBe(CONFIG_ID);
      expect(result.department).toBe('CSE');
      expect(result.sections).toEqual(['A', 'B']);
      expect(result.generatedAt).toBeNull();
      expect(result.subjects).toHaveLength(1);
    });

    it('throws NotFoundException when query returns empty array', async () => {
      mockQuery.mockResolvedValueOnce([]); // SELECT config → not found

      await expect(svc.getConfig('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerErrorException when db is null', async () => {
      const noDb = await buildService(false);
      await expect(noDb.getConfig(CONFIG_ID)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── listConfigs ─────────────────────────────────────────────────────────────

  describe('listConfigs()', () => {
    it('returns array of configs when no department filter', async () => {
      mockQuery.mockResolvedValueOnce([rawConfigRow]);

      const result = await svc.listConfigs();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const sql: string = mockQuery.mock.calls[0][0] as string;
      expect(sql).not.toContain('WHERE');
      expect(result).toHaveLength(1);
      expect(result[0].department).toBe('CSE');
    });

    it('filters by department when provided', async () => {
      mockQuery.mockResolvedValueOnce([rawConfigRow]);

      const result = await svc.listConfigs('CSE');

      const sql: string = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('WHERE');
      const params: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
      expect(params).toContain('CSE');
      expect(result).toHaveLength(1);
    });

    it('returns [] when db is null', async () => {
      const noDb = await buildService(false);
      const result = await noDb.listConfigs();
      expect(result).toEqual([]);
    });
  });

  // ── getClassrooms ───────────────────────────────────────────────────────────

  describe('getClassrooms()', () => {
    it('returns mapped classrooms', async () => {
      mockQuery.mockResolvedValueOnce([rawClassroomRow]);

      const result = await svc.getClassrooms();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('room-uuid-1');
      expect(result[0].name).toBe('LH-101');
      expect(result[0].building).toBe('Block A');
      expect(result[0].capacity).toBe(60);
      expect(result[0].type).toBe('LECTURE');
      expect(result[0].isActive).toBe(true);
    });

    it('returns [] when db is null', async () => {
      const noDb = await buildService(false);
      const result = await noDb.getClassrooms();
      expect(result).toEqual([]);
    });
  });

  // ── getSlots ────────────────────────────────────────────────────────────────

  describe('getSlots()', () => {
    const rawSlotRow = {
      id: 'slot-uuid-1',
      config_id: CONFIG_ID,
      section: 'A',
      day: 'MON',
      period: 1,
      subject_code: '21CS51',
      subject_name: 'Machine Learning',
      subject_type: 'THEORY',
      faculty_name: 'Dr. Sharma',
      classroom_id: 'room-uuid-1',
      classroom_name: 'LH-101',
      is_break: false,
    };

    it('returns slots for configId without section filter', async () => {
      mockQuery.mockResolvedValueOnce([rawSlotRow]);

      const result = await svc.getSlots(CONFIG_ID);

      expect(result).toHaveLength(1);
      expect(result[0].configId).toBe(CONFIG_ID);
      expect(result[0].isBreak).toBe(false);
      const sql: string = mockQuery.mock.calls[0][0] as string;
      expect(sql).not.toContain('section=$2');
    });

    it('returns slots filtered by section when section is provided', async () => {
      mockQuery.mockResolvedValueOnce([rawSlotRow]);

      await svc.getSlots(CONFIG_ID, 'A');

      const sql: string = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('section=$2');
      const params: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
      expect(params).toContain('A');
    });

    it('returns [] when db is null', async () => {
      const noDb = await buildService(false);
      const result = await noDb.getSlots(CONFIG_ID);
      expect(result).toEqual([]);
    });
  });

  // ── getConflicts ─────────────────────────────────────────────────────────────

  describe('getConflicts()', () => {
    const rawConflictRow = {
      id: 'conflict-uuid-1',
      config_id: CONFIG_ID,
      conflict_type: 'FACULTY_CLASH',
      description: 'Dr. Sharma double-booked',
      day: 'MON',
      period: 3,
      affected_entity: 'Dr. Sharma',
      severity: 'ERROR',
      created_at: '2024-01-01T00:00:00Z',
    };

    it('returns mapped conflicts for configId', async () => {
      mockQuery.mockResolvedValueOnce([rawConflictRow]);

      const result = await svc.getConflicts(CONFIG_ID);

      expect(result).toHaveLength(1);
      expect(result[0].conflictType).toBe('FACULTY_CLASH');
      expect(result[0].severity).toBe('ERROR');
      expect(result[0].period).toBe(3);
    });

    it('handles null period in conflict row', async () => {
      mockQuery.mockResolvedValueOnce([{ ...rawConflictRow, period: null }]);

      const result = await svc.getConflicts(CONFIG_ID);

      expect(result[0].period).toBeNull();
    });

    it('returns [] when db is null', async () => {
      const noDb = await buildService(false);
      const result = await noDb.getConflicts(CONFIG_ID);
      expect(result).toEqual([]);
    });
  });

  // ── publishConfig ────────────────────────────────────────────────────────────

  describe('publishConfig()', () => {
    it('calls UPDATE with PUBLISHED status and returns config', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // UPDATE status
        .mockResolvedValueOnce([rawConfigRow]) // SELECT config (getConfig)
        .mockResolvedValueOnce([rawSubjectRow]); // SELECT subjects

      const result = await svc.publishConfig(CONFIG_ID);

      const updateCall: string = mockQuery.mock.calls[0][0] as string;
      expect(updateCall).toContain("status='PUBLISHED'");
      expect(result.id).toBe(CONFIG_ID);
    });

    it('throws InternalServerErrorException when db is null', async () => {
      const noDb = await buildService(false);
      await expect(noDb.publishConfig(CONFIG_ID)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── deleteConfig ─────────────────────────────────────────────────────────────

  describe('deleteConfig()', () => {
    it('calls DELETE query with configId', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await svc.deleteConfig(CONFIG_ID);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const sql: string = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('DELETE FROM timetable_configs');
      expect(mockQuery.mock.calls[0][1]).toEqual([CONFIG_ID]);
    });

    it('throws InternalServerErrorException when db is null', async () => {
      const noDb = await buildService(false);
      await expect(noDb.deleteConfig(CONFIG_ID)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── generate ─────────────────────────────────────────────────────────────────

  describe('generate()', () => {
    /**
     * Set up mockQuery for a full generate() happy path:
     *  1. getConfig → SELECT timetable_configs  (returns row)
     *  2. getConfig → SELECT timetable_subjects (returns subject)
     *  3. getClassrooms → SELECT classrooms     (returns classroom)
     *  4. persistSlots → DELETE timetable_slots
     *  5. persistSlots → INSERT slot (1 slot)
     *  6. persistConflicts → DELETE timetable_conflicts
     *  -- 0 conflict INSERTs because conflicts=[]
     *  7. UPDATE status='GENERATED'
     */
    function setupHappyPathMocks() {
      mockQuery
        .mockResolvedValueOnce([rawConfigRow])    // SELECT config
        .mockResolvedValueOnce([rawSubjectRow])   // SELECT subjects
        .mockResolvedValueOnce([rawClassroomRow]) // SELECT classrooms
        .mockResolvedValueOnce([])                // DELETE slots
        .mockResolvedValueOnce([])                // INSERT slot
        .mockResolvedValueOnce([])                // DELETE conflicts
        .mockResolvedValueOnce([]);               // UPDATE status
    }

    it('happy path: returns GeneratedTimetable with populated views', async () => {
      setupHappyPathMocks();
      mockClaudeGenerate.mockResolvedValueOnce(minimalGeminiJson);

      const result = await svc.generate(CONFIG_ID);

      expect(result.configId).toBe(CONFIG_ID);
      expect(result.slots).toHaveLength(1);
      expect(result.conflicts).toHaveLength(0);
      expect(result.generatedAt).toBeTruthy();

      // viewBySection[A][MON][1] should exist
      expect(result.viewBySection['A']).toBeDefined();
      expect(result.viewBySection['A']['MON']).toBeDefined();
      expect(result.viewBySection['A']['MON'][1]).toBeDefined();

      // viewByFaculty for Dr. Sharma
      expect(result.viewByFaculty['Dr. Sharma']).toHaveLength(1);

      // viewByClassroom for LH-101
      expect(result.viewByClassroom['LH-101']).toHaveLength(1);
    });

    it('throws InternalServerErrorException when db is null', async () => {
      const noDb = await buildService(false);
      await expect(noDb.generate(CONFIG_ID)).rejects.toThrow(InternalServerErrorException);
    });

    it('throws InternalServerErrorException when Claude throws an Error', async () => {
      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([rawClassroomRow]);
      mockClaudeGenerate.mockRejectedValueOnce(new Error('Claude API down'));

      await expect(svc.generate(CONFIG_ID)).rejects.toThrow(InternalServerErrorException);
    });

    it('throws InternalServerErrorException when Claude throws a non-Error string', async () => {
      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([rawClassroomRow]);
      mockClaudeGenerate.mockRejectedValueOnce('rate_limit_exceeded');

      await expect(svc.generate(CONFIG_ID)).rejects.toThrow(InternalServerErrorException);
    });

    it('throws InternalServerErrorException when JSON parse fails', async () => {
      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([rawClassroomRow]);
      mockClaudeGenerate.mockResolvedValueOnce('not json at all');

      await expect(svc.generate(CONFIG_ID)).rejects.toThrow(InternalServerErrorException);
    });

    it('strips plain ``` fences before parsing', async () => {
      setupHappyPathMocks();
      const fenced = `\`\`\`\n${minimalGeminiJson}\n\`\`\``;
      mockClaudeGenerate.mockResolvedValueOnce(fenced);

      const result = await svc.generate(CONFIG_ID);

      expect(result.slots).toHaveLength(1);
    });

    it('strips ```json fences before parsing', async () => {
      setupHappyPathMocks();
      const fenced = `\`\`\`json\n${minimalGeminiJson}\n\`\`\``;
      mockClaudeGenerate.mockResolvedValueOnce(fenced);

      const result = await svc.generate(CONFIG_ID);

      expect(result.slots).toHaveLength(1);
    });

    it('defaults conflicts to [] when parsed.conflicts is undefined', async () => {
      // Claude response has no conflicts key
      const noConflictsJson = JSON.stringify({ slots: [geminiSlot] });
      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([rawClassroomRow])
        .mockResolvedValueOnce([]) // DELETE slots
        .mockResolvedValueOnce([]) // INSERT slot
        .mockResolvedValueOnce([]) // DELETE conflicts (0 inserts)
        .mockResolvedValueOnce([]); // UPDATE status
      mockClaudeGenerate.mockResolvedValueOnce(noConflictsJson);

      const result = await svc.generate(CONFIG_ID);

      expect(result.conflicts).toEqual([]);
    });

    it('slot with unknown classroomName → classroomId is null in persisted slot', async () => {
      const slotWithUnknownRoom = { ...geminiSlot, classroomName: 'UNKNOWN-ROOM' };
      const json = JSON.stringify({ slots: [slotWithUnknownRoom], conflicts: [] });
      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([rawClassroomRow]) // LH-101 known, UNKNOWN-ROOM not in list
        .mockResolvedValueOnce([])  // DELETE slots
        .mockResolvedValueOnce([])  // INSERT slot
        .mockResolvedValueOnce([])  // DELETE conflicts
        .mockResolvedValueOnce([]); // UPDATE status
      mockClaudeGenerate.mockResolvedValueOnce(json);

      await svc.generate(CONFIG_ID);

      // Find the INSERT slot call (index 4 = 5th query)
      const insertSlotCall = mockQuery.mock.calls[4];
      const params = insertSlotCall[1] as unknown[];
      // classroom_id is param index 9 (0-based): $10 corresponds to classroom?.id ?? null
      expect(params[9]).toBeNull();
    });

    it('breaks (isBreak=true) are excluded from viewByFaculty and viewByClassroom', async () => {
      const breakSlot = {
        section: 'A',
        day: 'MON',
        period: 4,
        isBreak: true,
      };
      const normalSlot = { ...geminiSlot, period: 1 };
      const json = JSON.stringify({ slots: [normalSlot, breakSlot], conflicts: [] });

      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([rawClassroomRow])
        .mockResolvedValueOnce([]) // DELETE slots
        .mockResolvedValueOnce([]) // INSERT normal slot
        .mockResolvedValueOnce([]) // INSERT break slot
        .mockResolvedValueOnce([]) // DELETE conflicts
        .mockResolvedValueOnce([]); // UPDATE status
      mockClaudeGenerate.mockResolvedValueOnce(json);

      const result = await svc.generate(CONFIG_ID);

      // viewBySection should include the break slot
      expect(result.viewBySection['A']['MON'][4]).toBeDefined();
      expect(result.viewBySection['A']['MON'][4].isBreak).toBe(true);

      // viewByFaculty should only have the non-break slot
      expect(result.viewByFaculty['Dr. Sharma']).toHaveLength(1);
      // viewByClassroom should only have the non-break slot
      expect(result.viewByClassroom['LH-101']).toHaveLength(1);
    });

    it('prompt contains department, semester, and "no markdown" instruction', async () => {
      setupHappyPathMocks();
      mockClaudeGenerate.mockResolvedValueOnce(minimalGeminiJson);

      await svc.generate(CONFIG_ID);

      const prompt: string = mockClaudeGenerate.mock.calls[0][0] as string;
      expect(prompt).toContain('CSE');
      expect(prompt).toContain('5');
      expect(prompt).toContain('no markdown');
    });

    it('uses claude-sonnet-4-6 model', async () => {
      setupHappyPathMocks();
      mockClaudeGenerate.mockResolvedValueOnce(minimalGeminiJson);

      await svc.generate(CONFIG_ID);

      expect(mockClaudeGenerate).toHaveBeenCalledWith(
        expect.any(String),
        'claude-sonnet-4-6',
        8192,
      );
    });

    it('NotFoundException propagates when getConfig throws (config not found)', async () => {
      // getConfig → SELECT returns []
      mockQuery.mockResolvedValueOnce([]); // SELECT config → not found

      await expect(svc.generate(CONFIG_ID)).rejects.toThrow(NotFoundException);
    });

    it('persists conflicts when Claude returns non-empty conflicts array', async () => {
      const conflict = {
        conflictType: 'FACULTY_CLASH',
        description: 'Dr. Sharma double-booked',
        day: 'MON',
        period: 3,
        affectedEntity: 'Dr. Sharma',
        severity: 'ERROR',
      };
      const json = JSON.stringify({ slots: [geminiSlot], conflicts: [conflict] });

      mockQuery
        .mockResolvedValueOnce([rawConfigRow])    // SELECT config
        .mockResolvedValueOnce([rawSubjectRow])   // SELECT subjects
        .mockResolvedValueOnce([rawClassroomRow]) // SELECT classrooms
        .mockResolvedValueOnce([])                // DELETE slots
        .mockResolvedValueOnce([])                // INSERT slot
        .mockResolvedValueOnce([])                // DELETE conflicts
        .mockResolvedValueOnce([])                // INSERT conflict (line 459)
        .mockResolvedValueOnce([]);               // UPDATE status
      mockClaudeGenerate.mockResolvedValueOnce(json);

      const result = await svc.generate(CONFIG_ID);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('FACULTY_CLASH');
      expect(result.conflicts[0].severity).toBe('ERROR');
    });

    it('fills conflict defaults when day/period/affectedEntity/severity are missing', async () => {
      // Covers the ?? null / ?? "ERROR" branches in persistConflicts and buildViews
      const minimalConflict = {
        conflictType: 'ROOM_CLASH',
        description: 'Room overbooked',
        // day, period, affectedEntity, severity all omitted
      };
      const json = JSON.stringify({ slots: [geminiSlot], conflicts: [minimalConflict] });

      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([rawClassroomRow])
        .mockResolvedValueOnce([]) // DELETE slots
        .mockResolvedValueOnce([]) // INSERT slot
        .mockResolvedValueOnce([]) // DELETE conflicts
        .mockResolvedValueOnce([]) // INSERT conflict
        .mockResolvedValueOnce([]); // UPDATE status
      mockClaudeGenerate.mockResolvedValueOnce(json);

      const result = await svc.generate(CONFIG_ID);

      // buildViews fills defaults
      expect(result.conflicts[0].day).toBeNull();
      expect(result.conflicts[0].period).toBeNull();
      expect(result.conflicts[0].affectedEntity).toBeNull();
      expect(result.conflicts[0].severity).toBe('ERROR');

      // persistConflicts also uses ?? null / ?? 'ERROR' — verify the INSERT was called
      const conflictInsertCall = mockQuery.mock.calls[6]; // 7th call (0-based index 6)
      const params = conflictInsertCall[1] as unknown[];
      expect(params[4]).toBeNull();   // day → null
      expect(params[5]).toBeNull();   // period → null
      expect(params[6]).toBeNull();   // affectedEntity → null
      expect(params[7]).toBe('ERROR'); // severity → 'ERROR' default
    });

    it('slot with no isBreak field defaults isBreak to false in buildViews', async () => {
      const slotWithoutIsBreak = {
        section: 'A', day: 'MON', period: 2,
        subjectCode: '21CS51', subjectName: 'ML', subjectType: 'THEORY',
        facultyName: 'Dr. Sharma', classroomName: 'LH-101',
        // isBreak intentionally omitted
      };
      const json = JSON.stringify({ slots: [slotWithoutIsBreak], conflicts: [] });

      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([rawClassroomRow])
        .mockResolvedValueOnce([]) // DELETE slots
        .mockResolvedValueOnce([]) // INSERT slot
        .mockResolvedValueOnce([]) // DELETE conflicts
        .mockResolvedValueOnce([]); // UPDATE status
      mockClaudeGenerate.mockResolvedValueOnce(json);

      const result = await svc.generate(CONFIG_ID);

      expect(result.slots[0].isBreak).toBe(false);
    });

    it('parsed.slots is undefined → defaults to [] (line 330 ?? branch)', async () => {
      // Claude returns JSON with no slots key at all
      const json = JSON.stringify({ conflicts: [] });

      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([rawClassroomRow])
        .mockResolvedValueOnce([]) // DELETE slots (persistSlots called with [])
        // no slot INSERTs since slots=[]
        .mockResolvedValueOnce([]) // DELETE conflicts
        .mockResolvedValueOnce([]); // UPDATE status
      mockClaudeGenerate.mockResolvedValueOnce(json);

      const result = await svc.generate(CONFIG_ID);

      expect(result.slots).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('buildPrompt uses fallback classroom names when no classrooms exist (|| branch)', async () => {
      // No classrooms returned → lectureRooms and labRooms are empty strings
      // → prompt falls back to hardcoded 'LH-101, LH-102, LH-103' and 'LAB-CS-A, LAB-CS-B'
      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([]) // getClassrooms → [] (no rooms)
        .mockResolvedValueOnce([]) // DELETE slots
        .mockResolvedValueOnce([]) // DELETE conflicts
        .mockResolvedValueOnce([]); // UPDATE status
      mockClaudeGenerate.mockResolvedValueOnce(minimalGeminiJson);

      await svc.generate(CONFIG_ID);

      const prompt: string = mockClaudeGenerate.mock.calls[0][0] as string;
      expect(prompt).toContain('LH-101, LH-102, LH-103');
      expect(prompt).toContain('LAB-CS-A, LAB-CS-B');
    });

    it('logger line uses ?? 0 when parsed.slots/conflicts are undefined', async () => {
      // Claude returns {} with no slots or conflicts keys
      const json = JSON.stringify({});

      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        .mockResolvedValueOnce([rawClassroomRow])
        .mockResolvedValueOnce([]) // DELETE slots
        .mockResolvedValueOnce([]) // DELETE conflicts
        .mockResolvedValueOnce([]); // UPDATE status
      mockClaudeGenerate.mockResolvedValueOnce(json);

      // Should not throw — ?? 0 handles undefined .length
      const result = await svc.generate(CONFIG_ID);
      expect(result.slots).toHaveLength(0);
    });
  });

  // ── buildViews — tested via generate() ──────────────────────────────────────

  describe('buildViews() — via generate()', () => {
    /** Wire up mockQuery for a generate() call with arbitrary slot list. */
    function setupForViews(slots: object[]): void {
      const json = JSON.stringify({ slots, conflicts: [] });

      jest.clearAllMocks();
      // getConfig: SELECT config + SELECT subjects
      mockQuery
        .mockResolvedValueOnce([rawConfigRow])
        .mockResolvedValueOnce([rawSubjectRow])
        // getClassrooms
        .mockResolvedValueOnce([rawClassroomRow])
        // persistSlots: DELETE + one INSERT per slot
        .mockResolvedValueOnce([]); // DELETE slots
      for (let i = 0; i < slots.length; i++) {
        mockQuery.mockResolvedValueOnce([]); // INSERT slot
      }
      // persistConflicts: DELETE (no conflict INSERTs since conflicts=[])
      mockQuery
        .mockResolvedValueOnce([]) // DELETE conflicts
        .mockResolvedValueOnce([]); // UPDATE status='GENERATED'

      mockClaudeGenerate.mockResolvedValueOnce(json);
    }

    it('viewBySection[section][day][period] = correct slot', async () => {
      const slot1 = { section: 'A', day: 'MON', period: 1, subjectCode: 'X', subjectName: 'X-Name', subjectType: 'THEORY', facultyName: 'Prof A', classroomName: 'LH-101', isBreak: false };
      const slot2 = { section: 'B', day: 'TUE', period: 2, subjectCode: 'Y', subjectName: 'Y-Name', subjectType: 'THEORY', facultyName: 'Prof B', classroomName: 'LH-101', isBreak: false };
      setupForViews([slot1, slot2]);

      const result = await svc.generate(CONFIG_ID);

      expect(result.viewBySection['A']['MON'][1].subjectCode).toBe('X');
      expect(result.viewBySection['B']['TUE'][2].subjectCode).toBe('Y');
    });

    it('viewByFaculty groups slots by facultyName, excludes breaks', async () => {
      const s1 = { section: 'A', day: 'MON', period: 1, facultyName: 'Prof A', classroomName: 'LH-101', isBreak: false };
      const s2 = { section: 'A', day: 'TUE', period: 1, facultyName: 'Prof A', classroomName: 'LH-101', isBreak: false };
      const brk = { section: 'A', day: 'MON', period: 4, isBreak: true };
      setupForViews([s1, s2, brk]);

      const result = await svc.generate(CONFIG_ID);

      expect(result.viewByFaculty['Prof A']).toHaveLength(2);
      expect(result.viewByFaculty['Prof A'].every((sl: TimetableSlot) => !sl.isBreak)).toBe(true);
    });

    it('viewByClassroom groups slots by classroomName, excludes breaks', async () => {
      const s1 = { section: 'A', day: 'MON', period: 1, facultyName: 'Prof A', classroomName: 'LH-101', isBreak: false };
      const s2 = { section: 'B', day: 'MON', period: 1, facultyName: 'Prof B', classroomName: 'LH-101', isBreak: false };
      const brk = { section: 'A', day: 'MON', period: 4, isBreak: true };
      setupForViews([s1, s2, brk]);

      const result = await svc.generate(CONFIG_ID);

      expect(result.viewByClassroom['LH-101']).toHaveLength(2);
    });
  });
});
