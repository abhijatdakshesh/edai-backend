/**
 * EarlyWarningController + EwsAdminController — unit tests
 * All EarlyWarningService calls are mocked.
 */

import { BadRequestException, ForbiddenException, INestApplication, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import supertest = require('supertest');
import { EarlyWarningController, EwsAdminController } from './early-warning.controller';
import { EarlyWarningService } from './early-warning.service';
import type { RiskSnapshotEntity } from './entities/risk-snapshot.entity';
import type { AlertEventEntity } from './entities/alert-event.entity';
import type { ScoringWeightEntity } from './entities/scoring-weight.entity';
import type { ScoreStudentDto } from './early-warning.service';
import { RolesGuard } from './roles.guard';

const mockEws = {
  scoreStudent: jest.fn(),
  getLatestRisk: jest.fn(),
  getRiskHistory: jest.fn(),
  getActiveAlerts: jest.fn(),
  acknowledgeAlert: jest.fn(),
  getWeights: jest.fn(),
  updateWeights: jest.fn(),
};

async function buildControllers() {
  const module = await Test.createTestingModule({
    controllers: [EarlyWarningController, EwsAdminController],
    providers: [
      { provide: EarlyWarningService, useValue: mockEws },
      RolesGuard,
      Reflector,
    ],
  }).compile();
  return {
    ctrl: module.get(EarlyWarningController),
    admin: module.get(EwsAdminController),
    guard: module.get(RolesGuard),
  };
}

describe('EarlyWarningController', () => {
  let ctrl: EarlyWarningController;

  beforeEach(async () => {
    jest.resetAllMocks();
    ({ ctrl } = await buildControllers());
  });

  const SCORE_BODY: Omit<ScoreStudentDto, 'studentId'> = {
    academicYear: '2025-2026',
    semester: 4,
    attendancePct: 80,
    marksAvg: 60,
    feesOverdueDays: 0,
    examRegistered: true,
    assignmentsSubmitted: 8,
    assignmentsTotal: 10,
  };

  // ── scoreStudent ──────────────────────────────────────────────────────────

  describe('scoreStudent', () => {
    it('delegates to service with studentId merged in', async () => {
      const snapshot = { id: 's-1', studentId: 'stu-1' } as RiskSnapshotEntity;
      mockEws.scoreStudent.mockResolvedValue(snapshot);

      const result = await ctrl.scoreStudent('stu-1', SCORE_BODY);

      expect(mockEws.scoreStudent).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 'stu-1', academicYear: '2025-2026' }),
      );
      expect(result).toBe(snapshot);
    });

    it('overwrites studentId in body with path param', async () => {
      const snapshot = { id: 's-1', studentId: 'stu-param' } as RiskSnapshotEntity;
      mockEws.scoreStudent.mockResolvedValue(snapshot);
      await ctrl.scoreStudent('stu-param', { ...SCORE_BODY, studentId: 'stu-injected' } as Omit<ScoreStudentDto, 'studentId'>);
      expect(mockEws.scoreStudent).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 'stu-param' }),
      );
    });

    it('propagates service rejection (DB error)', async () => {
      mockEws.scoreStudent.mockRejectedValue(new Error('DB connection failed'));
      await expect(ctrl.scoreStudent('stu-1', SCORE_BODY)).rejects.toThrow('DB connection failed');
    });
  });

  // ── getLatestRisk ─────────────────────────────────────────────────────────

  describe('getLatestRisk', () => {
    it('returns latest snapshot', async () => {
      const snapshot = { id: 's-1' } as RiskSnapshotEntity;
      mockEws.getLatestRisk.mockResolvedValue(snapshot);
      const result = await ctrl.getLatestRisk('stu-1');
      expect(result).toBe(snapshot);
    });

    it('returns null when no snapshot exists', async () => {
      mockEws.getLatestRisk.mockResolvedValue(null);
      expect(await ctrl.getLatestRisk('unknown')).toBeNull();
    });
  });

  // ── getRiskHistory ────────────────────────────────────────────────────────

  describe('getRiskHistory', () => {
    it('uses default 90 days when query param absent', async () => {
      mockEws.getRiskHistory.mockResolvedValue([]);
      await ctrl.getRiskHistory('stu-1');
      expect(mockEws.getRiskHistory).toHaveBeenCalledWith('stu-1', 90);
    });

    it('parses numeric days query param', async () => {
      mockEws.getRiskHistory.mockResolvedValue([]);
      await ctrl.getRiskHistory('stu-1', '30');
      expect(mockEws.getRiskHistory).toHaveBeenCalledWith('stu-1', 30);
    });

    it('accepts days=1 (minimum valid boundary)', async () => {
      mockEws.getRiskHistory.mockResolvedValue([]);
      await ctrl.getRiskHistory('stu-1', '1');
      expect(mockEws.getRiskHistory).toHaveBeenCalledWith('stu-1', 1);
    });

    it('throws BadRequestException for non-numeric days', async () => {
      await expect(ctrl.getRiskHistory('stu-1', 'abc')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for days=0', async () => {
      await expect(ctrl.getRiskHistory('stu-1', '0')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for negative days', async () => {
      await expect(ctrl.getRiskHistory('stu-1', '-5')).rejects.toThrow(BadRequestException);
    });
  });

  // ── getAlerts ─────────────────────────────────────────────────────────────

  describe('getAlerts', () => {
    it('returns all alerts when no studentId filter', async () => {
      const alerts = [{ id: 'a-1' }] as AlertEventEntity[];
      mockEws.getActiveAlerts.mockResolvedValue(alerts);
      const result = await ctrl.getAlerts();
      expect(mockEws.getActiveAlerts).toHaveBeenCalledWith(undefined);
      expect(result).toBe(alerts);
    });

    it('passes studentId filter when provided', async () => {
      mockEws.getActiveAlerts.mockResolvedValue([]);
      await ctrl.getAlerts('stu-1');
      expect(mockEws.getActiveAlerts).toHaveBeenCalledWith('stu-1');
    });
  });

  // ── acknowledge ───────────────────────────────────────────────────────────

  describe('acknowledge', () => {
    it('delegates to service and returns updated alert', async () => {
      const alert = { id: 'a-1', acknowledgedBy: 'admin-1' } as AlertEventEntity;
      mockEws.acknowledgeAlert.mockResolvedValue(alert);
      const result = await ctrl.acknowledge('a-1', { acknowledgedBy: 'admin-1' });
      expect(mockEws.acknowledgeAlert).toHaveBeenCalledWith('a-1', { acknowledgedBy: 'admin-1' });
      expect(result).toBe(alert);
    });

    it('propagates NotFoundException from service', async () => {
      mockEws.acknowledgeAlert.mockRejectedValue(new NotFoundException());
      await expect(ctrl.acknowledge('missing', { acknowledgedBy: 'x' })).rejects.toThrow(NotFoundException);
    });
  });
});

// ── EwsAdminController ────────────────────────────────────────────────────────

describe('EwsAdminController', () => {
  let admin: EwsAdminController;

  beforeEach(async () => {
    jest.resetAllMocks();
    ({ admin } = await buildControllers());
  });

  describe('getWeights', () => {
    it('returns active weights', async () => {
      const weights = [{ factor: 'attendance', weight: 0.35 }] as ScoringWeightEntity[];
      mockEws.getWeights.mockResolvedValue(weights);
      expect(await admin.getWeights()).toBe(weights);
    });

    it('returns empty array when no weights configured (new institution)', async () => {
      mockEws.getWeights.mockResolvedValue([]);
      expect(await admin.getWeights()).toEqual([]);
    });
  });

  describe('updateWeights', () => {
    const validBody = [
      { factor: 'attendance' as const, weight: 0.35 },
      { factor: 'marks' as const, weight: 0.30 },
      { factor: 'fees' as const, weight: 0.15 },
      { factor: 'assignments' as const, weight: 0.12 },
      { factor: 'exam_reg' as const, weight: 0.08 },
    ];

    it('delegates valid body to service', async () => {
      mockEws.updateWeights.mockResolvedValue(validBody);
      const result = await admin.updateWeights(validBody);
      expect(mockEws.updateWeights).toHaveBeenCalledWith(validBody);
      expect(result).toBe(validBody);
    });

    it('throws BadRequestException for empty array', async () => {
      await expect(admin.updateWeights([])).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when body is null (non-array)', async () => {
      await expect(admin.updateWeights(null as never)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when body is a plain object (non-array)', async () => {
      await expect(admin.updateWeights({ factor: 'attendance', weight: 0.35 } as never)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for NaN weight', async () => {
      const body = [{ factor: 'attendance' as const, weight: NaN }];
      await expect(admin.updateWeights(body)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for Infinity weight', async () => {
      const body = [{ factor: 'attendance' as const, weight: Infinity }];
      await expect(admin.updateWeights(body)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for -Infinity weight', async () => {
      const body = [{ factor: 'attendance' as const, weight: -Infinity }];
      await expect(admin.updateWeights(body)).rejects.toThrow(BadRequestException);
    });

    it('propagates service error for weights not summing to 1', async () => {
      mockEws.updateWeights.mockRejectedValue(new Error('Weights must sum to 1.0'));
      const body = [{ factor: 'attendance' as const, weight: 0.5 }];
      await expect(admin.updateWeights(body)).rejects.toThrow('Weights must sum to 1.0');
    });
  });
});

// ── RolesGuard — unit ─────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  let reflector: Reflector;

  beforeEach(() => {
    jest.resetAllMocks();
    reflector = new Reflector();
  });

  function makeCtx(role: string | undefined) {
    const req = { headers: {} as Record<string, string> };
    if (role !== undefined) req.headers['x-user-role'] = role;
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as import('@nestjs/common').ExecutionContext;
  }

  it('allows ADMIN to access admin endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'PRINCIPAL']);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx('ADMIN'))).toBe(true);
  });

  it('allows PRINCIPAL to access admin endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'PRINCIPAL']);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx('PRINCIPAL'))).toBe(true);
  });

  it('throws ForbiddenException for STUDENT role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'PRINCIPAL']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeCtx('STUDENT'))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for FACULTY role with message including role name', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'PRINCIPAL']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeCtx('FACULTY'))).toThrow('Role FACULTY is not permitted');
  });

  it('throws UnauthorizedException when x-user-role header is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'PRINCIPAL']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(UnauthorizedException);
  });

  it('allows any role when required roles are undefined (no decorator)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx('STUDENT'))).toBe(true);
  });

  it('allows any role when required roles list is explicitly empty []', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx('STUDENT'))).toBe(true);
  });
});

// ── RolesGuard — HTTP pipeline (supertest) ────────────────────────────────────

describe('EwsAdminController — HTTP guard enforcement', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [EwsAdminController],
      providers: [
        { provide: EarlyWarningService, useValue: mockEws },
        RolesGuard,
        Reflector,
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.resetAllMocks());

  it('returns 401 when x-user-role header is absent', () => {
    return supertest(app.getHttpServer())
      .get('/ews/v1/admin/weights')
      .expect(401);
  });

  it('returns 403 for FACULTY role', () => {
    return supertest(app.getHttpServer())
      .get('/ews/v1/admin/weights')
      .set('x-user-role', 'FACULTY')
      .expect(403);
  });

  it('returns 403 for STUDENT role', () => {
    return supertest(app.getHttpServer())
      .get('/ews/v1/admin/weights')
      .set('x-user-role', 'STUDENT')
      .expect(403);
  });

  it('returns 200 for ADMIN role', () => {
    mockEws.getWeights.mockResolvedValue([]);
    return supertest(app.getHttpServer())
      .get('/ews/v1/admin/weights')
      .set('x-user-role', 'ADMIN')
      .expect(200);
  });

  it('returns 200 for PRINCIPAL role', () => {
    mockEws.getWeights.mockResolvedValue([]);
    return supertest(app.getHttpServer())
      .get('/ews/v1/admin/weights')
      .set('x-user-role', 'PRINCIPAL')
      .expect(200);
  });
});
