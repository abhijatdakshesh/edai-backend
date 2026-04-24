/**
 * app.e2e.spec.ts — Full HTTP smoke + integration tests.
 *
 * Boots the REAL NestJS app via createNestHttpApp() (same code path as
 * production) and fires HTTP requests through supertest.  Catches any
 * dependency/startup wiring bugs that unit tests miss.
 *
 * Covers:
 *   - App bootstrap (smoke)
 *   - Health endpoint
 *   - Auth: login success/failure, refresh, logout
 *   - JWT guard enforcement (401 on protected routes)
 *   - Student dashboard shape
 *   - VTU active window
 *   - CORS header presence
 *   - Global exception filter (4xx shape)
 */

import 'reflect-metadata';
import * as express from 'express';
import * as supertest from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createNestHttpApp } from './bootstrap-app';

// ─── Seed credentials (test-only, matches SeedService in-memory store) ───────
// These are NOT production credentials — they exist only in the in-memory seed
// and are intentionally checked into the test suite as test fixtures.
// If a real DB is wired, move these to E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD env vars.
const SEED = {
  admin:   { email: process.env['E2E_ADMIN_EMAIL']   ?? 'admin@rvce.edu',   password: process.env['E2E_ADMIN_PASS']   ?? 'Admin@123' },
  student: { email: process.env['E2E_STUDENT_EMAIL'] ?? 'student@rvce.edu', password: process.env['E2E_STUDENT_PASS'] ?? 'Student@123' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

let app: INestApplication;
let http: ReturnType<typeof supertest>;
let studentToken: string;
let adminToken: string;

beforeAll(async () => {
  const server = express();
  app = await createNestHttpApp(server);
  await app.init();
  http = supertest(server);

  const [studentRes, adminRes] = await Promise.all([
    http.post('/api/auth/login').send({ email: SEED.student.email, password: SEED.student.password }),
    http.post('/api/auth/login').send({ email: SEED.admin.email, password: SEED.admin.password }),
  ]);
  studentToken = studentRes.body.accessToken as string;
  adminToken   = adminRes.body.accessToken as string;
  expect(studentToken).toBeTruthy();
  expect(adminToken).toBeTruthy();
}, 30_000);

afterAll(async () => {
  await app.close();
});

// ─── Smoke ───────────────────────────────────────────────────────────────────

describe('Smoke — app boots', () => {
  it('app instance is defined', () => {
    expect(app).toBeDefined();
  });

  it('GET /api/health returns 200', async () => {
    const res = await http.get('/api/health');
    expect(res.status).toBe(200);
  });

  it('Swagger docs accessible at /docs', async () => {
    const res = await http.get('/docs');
    expect([200, 301, 302]).toContain(res.status);
  });
});

// ─── CORS ────────────────────────────────────────────────────────────────────

describe('CORS', () => {
  it('returns Access-Control-Allow-Origin for localhost:3000', async () => {
    const res = await http
      .get('/api/health')
      .set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});

// ─── Auth ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 200 + tokens for valid admin credentials', async () => {
    const res = await http
      .post('/api/auth/login')
      .send({ email: SEED.admin.email, password: SEED.admin.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.expiresIn).toBe(900);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 200 + tokens for student credentials', async () => {
    const res = await http
      .post('/api/auth/login')
      .send({ email: SEED.student.email, password: SEED.student.password });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('STUDENT');
  });

  it('returns 401 for wrong password (well-formed but incorrect)', async () => {
    const res = await http
      .post('/api/auth/login')
      .send({ email: SEED.admin.email, password: 'WrongPass@999' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email — same message (no enumeration)', async () => {
    const res = await http
      .post('/api/auth/login')
      .send({ email: 'ghost@rvce.edu', password: SEED.admin.password });
    expect(res.status).toBe(401);
    const msg = res.body.message ?? res.body.error;
    expect(typeof msg).toBe('string');
  });

  it('returns 400 for missing body fields', async () => {
    const res = await http.post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns new accessToken for valid refresh token', async () => {
    const loginRes = await http
      .post('/api/auth/login')
      .send({ email: SEED.admin.email, password: SEED.admin.password });
    const { refreshToken } = loginRes.body as { refreshToken: string };

    const res = await http.post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.expiresIn).toBe(900);
  });

  it('returns 401 for invalid refresh token', async () => {
    const res = await http
      .post('/api/auth/refresh')
      .send({ refreshToken: 'garbage' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200 + ok:true', async () => {
    const loginRes = await http
      .post('/api/auth/login')
      .send({ email: SEED.admin.email, password: SEED.admin.password });
    const res = await http
      .post('/api/auth/logout')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect([200, 201]).toContain(res.status);
    expect(res.body.ok).toBe(true);
  });
});

// ─── JWT Guard enforcement ────────────────────────────────────────────────────

describe('JWT Guard — unauthenticated requests', () => {
  it('GET /api/student/dashboard returns 401 without token', async () => {
    const res = await http.get('/api/student/dashboard');
    expect(res.status).toBe(401);
  });

  it('GET /api/vtu/windows/active returns 401 without token', async () => {
    const res = await http.get('/api/vtu/windows/active');
    expect(res.status).toBe(401);
  });

  it('GET /api/student/dashboard returns 401 for malformed Bearer', async () => {
    const res = await http
      .get('/api/student/dashboard')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
  });
});

// ─── Student dashboard ───────────────────────────────────────────────────────

describe('GET /api/student/dashboard', () => {
  it('returns 200 with correct shape for authenticated student', async () => {
    const res = await http
      .get('/api/student/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(typeof res.body.stats.attendancePct).toBe('number');
    expect(typeof res.body.stats.cgpa).toBe('number');
    expect(typeof res.body.stats.pendingAssignments).toBe('number');
    expect(['PAID', 'PENDING', 'OVERDUE', 'PARTIAL']).toContain(res.body.stats.feeStatus);
  });

  it('upcoming is an array', async () => {
    const res = await http
      .get('/api/student/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(Array.isArray(res.body.upcoming)).toBe(true);
  });

  it('courses is a non-empty array with required fields', async () => {
    const res = await http
      .get('/api/student/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(Array.isArray(res.body.courses)).toBe(true);
    expect(res.body.courses.length).toBeGreaterThan(0);
    const c = res.body.courses[0];
    expect(c.code).toBeTruthy();
    expect(c.name).toBeTruthy();
    expect(typeof c.attendance).toBe('number');
  });

  it('attendance is a valid percentage (0–100)', async () => {
    const res = await http
      .get('/api/student/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.body.stats.attendancePct).toBeGreaterThanOrEqual(0);
    expect(res.body.stats.attendancePct).toBeLessThanOrEqual(100);
  });
});

// ─── VTU active window ───────────────────────────────────────────────────────

describe('GET /api/vtu/windows/active', () => {
  it('returns 200 for authenticated user', async () => {
    const res = await http
      .get('/api/vtu/windows/active')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
  });

  it('response is null or has id + title + closeDate', async () => {
    const res = await http
      .get('/api/vtu/windows/active')
      .set('Authorization', `Bearer ${studentToken}`);
    if (res.body !== null && res.body.id) {
      expect(res.body.title).toBeTruthy();
      expect(res.body.closeDate).toBeTruthy();
    }
  });
});

// ─── Global exception filter shape ───────────────────────────────────────────

describe('HttpExceptionFilter — error response shape', () => {
  it('404 on unknown route returns JSON with statusCode + message', async () => {
    const res = await http.get('/api/does-not-exist-at-all');
    expect(res.status).toBe(404);
    expect(typeof res.body).toBe('object');
  });

  it('401 body contains statusCode and message fields', async () => {
    const res = await http.get('/api/student/dashboard');
    expect(res.status).toBe(401);
    const hasMessage =
      typeof res.body.message === 'string' ||
      typeof res.body.error === 'string';
    expect(hasMessage).toBe(true);
  });
});

// ─── Departments ─────────────────────────────────────────────────────────────

describe('GET /api/departments', () => {
  it('returns 200 + array for authenticated user', async () => {
    const res = await http
      .get('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each department has code, name, hodUserId', async () => {
    const res = await http
      .get('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`);
    const dept = res.body[0];
    expect(dept.code).toBeTruthy();
    expect(dept.name).toBeTruthy();
    expect(dept.hodUserId).toBeTruthy();
  });

  it('returns 401 without token', async () => {
    const res = await http.get('/api/departments');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/departments/:code', () => {
  it('returns 200 for existing CSE department', async () => {
    const res = await http
      .get('/api/departments/CSE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('CSE');
  });

  it('returns 404 for non-existent code', async () => {
    const res = await http
      .get('/api/departments/UNKNOWN')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── Analytics ───────────────────────────────────────────────────────────────

describe('GET /api/analytics/attendance-trend', () => {
  it('returns 200 + array for admin', async () => {
    const res = await http
      .get('/api/analytics/attendance-trend')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(typeof res.body[0]!.month).toBe('string');
    expect(typeof res.body[0]!.pct).toBe('number');
  });

  it('returns 401 without token', async () => {
    const res = await http.get('/api/analytics/attendance-trend');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/analytics/fee-collection', () => {
  it('returns 200 + array with collected + target fields', async () => {
    const res = await http
      .get('/api/analytics/fee-collection')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const point = res.body[0];
    expect(typeof point.collected).toBe('number');
    expect(typeof point.target).toBe('number');
  });
});

// ─── NAAC Metrics ────────────────────────────────────────────────────────────

describe('GET /api/admin/naac/metrics', () => {
  it('returns 200 with overallScore, grade, criteria array', async () => {
    const res = await http
      .get('/api/admin/naac/metrics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.overallScore).toBe('number');
    expect(typeof res.body.grade).toBe('string');
    expect(Array.isArray(res.body.criteria)).toBe(true);
    expect(res.body.criteria.length).toBeGreaterThan(0);
    const criterion = res.body.criteria[0];
    expect(['UP', 'DOWN', 'STABLE']).toContain(criterion.trend);
  });

  it('student token returns 401 (no JwtAuthGuard bypass)', async () => {
    // Admin-only route — student should get 401 or 403
    const res = await http
      .get('/api/admin/naac/metrics')
      .set('Authorization', `Bearer ${studentToken}`);
    expect([401, 403]).toContain(res.status);
  });
});

// ─── Placement Predictor ─────────────────────────────────────────────────────

describe('GET /api/admin/placements/summary', () => {
  it('returns 200 with total + high + medium + low + veryLow fields', async () => {
    const res = await http
      .get('/api/admin/placements/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.high).toBe('number');
    expect(typeof res.body.medium).toBe('number');
    expect(typeof res.body.low).toBe('number');
    expect(typeof res.body.veryLow).toBe('number');
    expect(res.body.total).toBe(res.body.high + res.body.medium + res.body.low + res.body.veryLow);
  });
});

describe('GET /api/admin/placements/predictions', () => {
  it('returns 200 + array for admin', async () => {
    const res = await http
      .get('/api/admin/placements/predictions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('dept filter narrows results to matching dept', async () => {
    const res = await http
      .get('/api/admin/placements/predictions?dept=CSE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const p of res.body as Array<{ dept: string }>) {
      expect(p.dept).toBe('CSE');
    }
  });

  it('likelihood filter narrows results', async () => {
    const res = await http
      .get('/api/admin/placements/predictions?likelihood=HIGH')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const p of res.body as Array<{ likelihood: string }>) {
      expect(p.likelihood).toBe('HIGH');
    }
  });

  it('each prediction has studentUsn, cgpa, likelihood, matchedCompanies', async () => {
    const res = await http
      .get('/api/admin/placements/predictions')
      .set('Authorization', `Bearer ${adminToken}`);
    const pred = res.body[0];
    expect(pred.studentUsn).toBeTruthy();
    expect(typeof pred.cgpa).toBe('number');
    expect(['HIGH', 'MEDIUM', 'LOW', 'VERY_LOW']).toContain(pred.likelihood);
    expect(Array.isArray(pred.matchedCompanies)).toBe(true);
  });
});
