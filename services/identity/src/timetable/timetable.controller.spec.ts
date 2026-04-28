/**
 * timetable.controller.spec.ts
 *
 * Unit tests for TimetableController.
 * TimetableService is fully mocked.  JwtAuthGuard is bypassed.
 * Tests assert delegation contracts and return-value pass-through only.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TimetableController } from './timetable.controller';
import { TimetableService, CreateConfigDto } from './timetable.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// ─── Mock service ─────────────────────────────────────────────────────────────

const mockSvc = {
  createConfig: jest.fn(),
  listConfigs: jest.fn(),
  getConfig: jest.fn(),
  deleteConfig: jest.fn(),
  generate: jest.fn(),
  publishConfig: jest.fn(),
  getSlots: jest.fn(),
  getConflicts: jest.fn(),
  getClassrooms: jest.fn(),
};

// ─── Helper ───────────────────────────────────────────────────────────────────

async function buildController(): Promise<TimetableController> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [TimetableController],
    providers: [{ provide: TimetableService, useValue: mockSvc }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return module.get<TimetableController>(TimetableController);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONFIG_ID = 'cfg-uuid-1234';

const mockConfig = {
  id: CONFIG_ID,
  department: 'CSE',
  semester: 5,
  academicYear: '2024-25',
  sections: ['A'],
  workingDays: ['MON', 'TUE'],
  periodsPerDay: 7,
  periodDurationMinutes: 55,
  breakAfterPeriod: 4,
  status: 'DRAFT',
  createdBy: 'admin',
  createdAt: '2024-01-01T00:00:00Z',
  generatedAt: null,
  subjects: [],
};

const mockGeneratedTimetable = {
  configId: CONFIG_ID,
  slots: [],
  conflicts: [],
  viewBySection: {},
  viewByFaculty: {},
  viewByClassroom: {},
  generatedAt: new Date().toISOString(),
};

const mockCreateDto: CreateConfigDto = {
  department: 'CSE',
  semester: 5,
  academicYear: '2024-25',
  sections: ['A'],
  subjects: [],
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('TimetableController', () => {
  let controller: TimetableController;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await buildController();
  });

  // ── createConfig ────────────────────────────────────────────────────────────

  describe('createConfig()', () => {
    it('delegates to svc.createConfig() with the request body', async () => {
      mockSvc.createConfig.mockResolvedValue(mockConfig);

      const result = await controller.createConfig(mockCreateDto);

      expect(mockSvc.createConfig).toHaveBeenCalledTimes(1);
      expect(mockSvc.createConfig).toHaveBeenCalledWith(mockCreateDto);
      expect(result).toBe(mockConfig);
    });

    it('returns the service result directly', async () => {
      mockSvc.createConfig.mockResolvedValue(mockConfig);

      const result = await controller.createConfig(mockCreateDto);

      expect(result).toStrictEqual(mockConfig);
    });

    it('propagates service rejection', async () => {
      mockSvc.createConfig.mockRejectedValue(new Error('DB error'));

      await expect(controller.createConfig(mockCreateDto)).rejects.toThrow('DB error');
    });
  });

  // ── listConfigs ─────────────────────────────────────────────────────────────

  describe('listConfigs()', () => {
    it('delegates with undefined when no department query param', async () => {
      mockSvc.listConfigs.mockResolvedValue([mockConfig]);

      const result = await controller.listConfigs(undefined);

      expect(mockSvc.listConfigs).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(1);
    });

    it('delegates with department string when provided', async () => {
      const expected = [mockConfig];
      mockSvc.listConfigs.mockResolvedValue(expected);

      const result = await controller.listConfigs('CSE');

      expect(mockSvc.listConfigs).toHaveBeenCalledWith('CSE');
      expect(result).toBe(expected);
    });

    it('propagates service rejection', async () => {
      mockSvc.listConfigs.mockRejectedValue(new Error('DB unavailable'));

      await expect(controller.listConfigs()).rejects.toThrow('DB unavailable');
    });
  });

  // ── getConfig ───────────────────────────────────────────────────────────────

  describe('getConfig()', () => {
    it('delegates to svc.getConfig() with the correct id', async () => {
      mockSvc.getConfig.mockResolvedValue(mockConfig);

      const result = await controller.getConfig(CONFIG_ID);

      expect(mockSvc.getConfig).toHaveBeenCalledTimes(1);
      expect(mockSvc.getConfig).toHaveBeenCalledWith(CONFIG_ID);
      expect(result).toBe(mockConfig);
    });

    it('returns the service result directly (no wrapping)', async () => {
      mockSvc.getConfig.mockResolvedValue(mockConfig);

      const result = await controller.getConfig(CONFIG_ID);

      expect(result).toStrictEqual(mockConfig);
    });

    it('propagates service rejection', async () => {
      mockSvc.getConfig.mockRejectedValue(new Error('Not found'));

      await expect(controller.getConfig(CONFIG_ID)).rejects.toThrow('Not found');
    });
  });

  // ── deleteConfig ─────────────────────────────────────────────────────────────

  describe('deleteConfig()', () => {
    it('delegates to svc.deleteConfig() with the correct id', async () => {
      mockSvc.deleteConfig.mockResolvedValue(undefined);

      await controller.deleteConfig(CONFIG_ID);

      expect(mockSvc.deleteConfig).toHaveBeenCalledTimes(1);
      expect(mockSvc.deleteConfig).toHaveBeenCalledWith(CONFIG_ID);
    });

    it('returns undefined (204 No Content route)', async () => {
      mockSvc.deleteConfig.mockResolvedValue(undefined);

      const result = await controller.deleteConfig(CONFIG_ID);

      expect(result).toBeUndefined();
    });

    it('propagates service rejection', async () => {
      mockSvc.deleteConfig.mockRejectedValue(new Error('Cannot delete'));

      await expect(controller.deleteConfig(CONFIG_ID)).rejects.toThrow('Cannot delete');
    });
  });

  // ── generate ─────────────────────────────────────────────────────────────────

  describe('generate()', () => {
    it('delegates to svc.generate() with the correct id', async () => {
      mockSvc.generate.mockResolvedValue(mockGeneratedTimetable);

      const result = await controller.generate(CONFIG_ID);

      expect(mockSvc.generate).toHaveBeenCalledTimes(1);
      expect(mockSvc.generate).toHaveBeenCalledWith(CONFIG_ID);
      expect(result).toBe(mockGeneratedTimetable);
    });

    it('returns the service result directly', async () => {
      mockSvc.generate.mockResolvedValue(mockGeneratedTimetable);

      const result = await controller.generate(CONFIG_ID);

      expect(result).toStrictEqual(mockGeneratedTimetable);
    });

    it('propagates service rejection', async () => {
      mockSvc.generate.mockRejectedValue(new Error('AI generation failed'));

      await expect(controller.generate(CONFIG_ID)).rejects.toThrow('AI generation failed');
    });
  });

  // ── publishConfig ────────────────────────────────────────────────────────────

  describe('publishConfig()', () => {
    it('delegates to svc.publishConfig() with the correct id', async () => {
      const publishedConfig = { ...mockConfig, status: 'PUBLISHED' };
      mockSvc.publishConfig.mockResolvedValue(publishedConfig);

      const result = await controller.publishConfig(CONFIG_ID);

      expect(mockSvc.publishConfig).toHaveBeenCalledTimes(1);
      expect(mockSvc.publishConfig).toHaveBeenCalledWith(CONFIG_ID);
      expect(result).toBe(publishedConfig);
    });

    it('returns the service result directly', async () => {
      const publishedConfig = { ...mockConfig, status: 'PUBLISHED' };
      mockSvc.publishConfig.mockResolvedValue(publishedConfig);

      const result = await controller.publishConfig(CONFIG_ID);

      expect(result).toStrictEqual(publishedConfig);
    });

    it('propagates service rejection', async () => {
      mockSvc.publishConfig.mockRejectedValue(new Error('Publish failed'));

      await expect(controller.publishConfig(CONFIG_ID)).rejects.toThrow('Publish failed');
    });
  });

  // ── getSlots ─────────────────────────────────────────────────────────────────

  describe('getSlots()', () => {
    const mockSlots = [
      { id: 'slot-1', configId: CONFIG_ID, section: 'A', day: 'MON', period: 1, isBreak: false },
    ];

    it('delegates without section filter when section is undefined', async () => {
      mockSvc.getSlots.mockResolvedValue(mockSlots);

      const result = await controller.getSlots(CONFIG_ID, undefined);

      expect(mockSvc.getSlots).toHaveBeenCalledTimes(1);
      expect(mockSvc.getSlots).toHaveBeenCalledWith(CONFIG_ID, undefined);
      expect(result).toBe(mockSlots);
    });

    it('delegates with section filter when section is provided', async () => {
      mockSvc.getSlots.mockResolvedValue(mockSlots);

      await controller.getSlots(CONFIG_ID, 'A');

      expect(mockSvc.getSlots).toHaveBeenCalledWith(CONFIG_ID, 'A');
    });

    it('propagates service rejection', async () => {
      mockSvc.getSlots.mockRejectedValue(new Error('Slots error'));

      await expect(controller.getSlots(CONFIG_ID)).rejects.toThrow('Slots error');
    });
  });

  // ── getConflicts ─────────────────────────────────────────────────────────────

  describe('getConflicts()', () => {
    const mockConflicts = [
      { id: 'conflict-1', configId: CONFIG_ID, conflictType: 'FACULTY_CLASH', description: 'Test', severity: 'ERROR' },
    ];

    it('delegates to svc.getConflicts() with the correct id', async () => {
      mockSvc.getConflicts.mockResolvedValue(mockConflicts);

      const result = await controller.getConflicts(CONFIG_ID);

      expect(mockSvc.getConflicts).toHaveBeenCalledTimes(1);
      expect(mockSvc.getConflicts).toHaveBeenCalledWith(CONFIG_ID);
      expect(result).toBe(mockConflicts);
    });

    it('returns the service result directly', async () => {
      mockSvc.getConflicts.mockResolvedValue(mockConflicts);

      const result = await controller.getConflicts(CONFIG_ID);

      expect(result).toStrictEqual(mockConflicts);
    });

    it('propagates service rejection', async () => {
      mockSvc.getConflicts.mockRejectedValue(new Error('Conflicts error'));

      await expect(controller.getConflicts(CONFIG_ID)).rejects.toThrow('Conflicts error');
    });
  });

  // ── getClassrooms ────────────────────────────────────────────────────────────

  describe('getClassrooms()', () => {
    const mockClassrooms = [
      { id: 'room-1', name: 'LH-101', building: 'Block A', capacity: 60, type: 'LECTURE', isActive: true },
    ];

    it('delegates to svc.getClassrooms() with no arguments', async () => {
      mockSvc.getClassrooms.mockResolvedValue(mockClassrooms);

      const result = await controller.getClassrooms();

      expect(mockSvc.getClassrooms).toHaveBeenCalledTimes(1);
      expect(mockSvc.getClassrooms).toHaveBeenCalledWith();
      expect(result).toBe(mockClassrooms);
    });

    it('returns the service result directly', async () => {
      mockSvc.getClassrooms.mockResolvedValue(mockClassrooms);

      const result = await controller.getClassrooms();

      expect(result).toStrictEqual(mockClassrooms);
    });

    it('propagates service rejection', async () => {
      mockSvc.getClassrooms.mockRejectedValue(new Error('Classrooms unavailable'));

      await expect(controller.getClassrooms()).rejects.toThrow('Classrooms unavailable');
    });
  });

  // ── Guard wiring ─────────────────────────────────────────────────────────────

  describe('guard configuration', () => {
    it('controller instantiates successfully with JwtAuthGuard overridden', () => {
      expect(controller).toBeDefined();
    });
  });
});
