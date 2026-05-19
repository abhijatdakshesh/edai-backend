/**
 * Unit tests: tenant-context.ts
 *
 * The college_id resolution is THE multi-tenant kill switch. A bug here
 * silently lets requests from tenant A read/write tenant B's data. Every
 * branch of the precedence chain must be exercised — including the
 * undocumented null/undefined paths.
 */

import { getCollegeFeatures, resolveCollegeId } from './tenant-context';

describe('resolveCollegeId()', () => {
  const originalEnv = process.env['DEFAULT_COLLEGE_ID'];

  afterEach(() => {
    if (originalEnv === undefined) delete process.env['DEFAULT_COLLEGE_ID'];
    else process.env['DEFAULT_COLLEGE_ID'] = originalEnv;
  });

  it('prefers req.user.collegeId over every other source', () => {
    process.env['DEFAULT_COLLEGE_ID'] = 'rvitm-env';
    const req = { user: { collegeId: 'col-from-jwt', institutionId: 'col-legacy' } };
    expect(resolveCollegeId(req)).toBe('col-from-jwt');
  });

  it('falls back to req.user.institutionId when collegeId absent', () => {
    process.env['DEFAULT_COLLEGE_ID'] = 'rvitm-env';
    const req = { user: { institutionId: 'col-legacy' } };
    expect(resolveCollegeId(req)).toBe('col-legacy');
  });

  it('falls back to DEFAULT_COLLEGE_ID env var when neither JWT claim present', () => {
    process.env['DEFAULT_COLLEGE_ID'] = 'rvitm-env';
    const req = { user: {} };
    expect(resolveCollegeId(req)).toBe('rvitm-env');
  });

  it("falls back to literal 'default' when env var is unset", () => {
    delete process.env['DEFAULT_COLLEGE_ID'];
    const req = { user: {} };
    expect(resolveCollegeId(req)).toBe('default');
  });

  it('returns env or default when req is undefined', () => {
    delete process.env['DEFAULT_COLLEGE_ID'];
    const noReq: unknown = undefined;
    expect(resolveCollegeId(noReq)).toBe('default');
    process.env['DEFAULT_COLLEGE_ID'] = 'rvitm-env';
    expect(resolveCollegeId(noReq)).toBe('rvitm-env');
  });

  it('returns env or default when req is null', () => {
    delete process.env['DEFAULT_COLLEGE_ID'];
    const nullReq: unknown = null;
    expect(resolveCollegeId(nullReq)).toBe('default');
  });

  it('returns env or default when req.user is missing', () => {
    delete process.env['DEFAULT_COLLEGE_ID'];
    expect(resolveCollegeId({})).toBe('default');
  });

  it('handles empty-string JWT claims by falling through (truthy check via ??)', () => {
    // Important: nullish coalescing (`??`) treats '' as a value, not falsy.
    // This is intentional — an empty-string collegeId is still a tenant
    // identifier and SHOULD be passed through (operator visibility), not
    // silently rewritten to 'default'. Test pins that behaviour.
    delete process.env['DEFAULT_COLLEGE_ID'];
    const req = { user: { collegeId: '' } };
    expect(resolveCollegeId(req)).toBe('');
  });

  it('handles non-object req gracefully (e.g. raw string)', () => {
    delete process.env['DEFAULT_COLLEGE_ID'];
    const rawString: unknown = 'not-a-request';
    expect(resolveCollegeId(rawString)).toBe('default');
  });
});

describe('getCollegeFeatures()', () => {
  it('returns the union of all flags (single-tenant phase)', () => {
    const flags = getCollegeFeatures('any-college-id');
    expect(flags.lms_assignments).toBe(true);
    expect(flags.lms_quizzes).toBe(true);
    expect(flags.lms_voice_tutor).toBe(true);
    expect(flags.lms_revision_call).toBe(true);
    expect(flags.lms_parent_digest).toBe(true);
    expect(flags.vtu_integration).toBe(true);
  });

  it('returns the same flag bag regardless of collegeId (no per-tenant override yet)', () => {
    const a = getCollegeFeatures('rvitm');
    const b = getCollegeFeatures('rvce');
    expect(a).toEqual(b);
  });

  it('feature object is independent across calls (callers may mutate safely)', () => {
    const a = getCollegeFeatures('rvitm');
    a.lms_assignments = false;
    const b = getCollegeFeatures('rvitm');
    // Caller-side mutation should not leak into subsequent reads.
    // (If this fails, the implementation is returning a shared singleton —
    // worth fixing because multi-tenant overrides will need per-call copies.)
    expect(b.lms_assignments).toBe(true);
  });
});
