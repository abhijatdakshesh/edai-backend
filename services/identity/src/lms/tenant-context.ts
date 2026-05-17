/**
 * Single source of truth for resolving the tenant (`college_id`) on each
 * request. This is the bridge between the current single-tenant deployment
 * (RVITM / Raycraft) and the multi-tenant rollout described in the EduStack
 * architecture proposal.
 *
 * Resolution order:
 *   1. JWT claim `req.user.collegeId` (set by AuthModule once Clerk Orgs lands)
 *   2. `req.user.institutionId`        (legacy claim used by Comms / Risk)
 *   3. env `DEFAULT_COLLEGE_ID`        (e.g. RVITM_UUID in single-tenant prod)
 *   4. literal `'default'`             (last-resort dev fallback)
 *
 * Once Postgres RLS is wired (Phase §3 of the proposal) the resolver here
 * is also responsible for `SET LOCAL app.college_id = '<uuid>'` on the
 * acquired DB connection.
 */
export function resolveCollegeId(req: unknown): string {
  const user = (req as { user?: { collegeId?: string; institutionId?: string } })?.user;
  return (
    user?.collegeId ??
    user?.institutionId ??
    process.env['DEFAULT_COLLEGE_ID'] ??
    'default'
  );
}

/**
 * Returns the per-college feature flag bag. Stub: currently returns the
 * union of all flags so every module is enabled while we are still in
 * single-tenant mode. Once `colleges.features` (Phase §7) is wired, this
 * will read from the cached tenant_context middleware result.
 */
export function getCollegeFeatures(_collegeId: string): Record<string, boolean> {
  return {
    lms_assignments: true,
    lms_quizzes: true,
    lms_discussions: true,
    lms_voice_tutor: true,
    lms_revision_call: true,
    lms_parent_digest: true,
    vtu_integration: true,
  };
}
