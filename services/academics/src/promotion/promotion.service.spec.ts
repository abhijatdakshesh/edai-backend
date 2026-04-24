/**
 * PromotionService — Jest unit tests
 *
 * Tests cover:
 *   generateEligibilityReport — DETAINED for attendance <75%, IA <40,
 *                               feeClearanceRequired+fee not cleared;
 *                               ELIGIBLE when all criteria pass
 *   executeBatchPromotion     — promotes ELIGIBLE+CONDITIONAL, leaves
 *                               DETAINED, returns correct USN lists & counts
 *   overrideStudent           — changes student status to CONDITIONAL with note
 */

import { PromotionService } from './promotion.service';

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * The service uses a module-level BATCHES array that persists across test
 * instances. Create a new PromotionService for every test and use unique
 * classId+fromSemester combos to avoid BadRequestException collisions.
 */
let semCounter = 100; // unique sentinel starting point
function nextSem() {
  return ++semCounter;
}

function makeDto(
  overrides: Partial<{
    classId: string;
    className: string;
    fromSemester: number;
    academicYear: string;
    criteria: Parameters<PromotionService['generateEligibilityReport']>[0]['criteria'];
  }> = {},
) {
  const sem = nextSem();
  return {
    classId: overrides.classId ?? `class-${sem}`,
    className: overrides.className ?? `CSE Sem ${sem}`,
    fromSemester: overrides.fromSemester ?? sem,
    academicYear: overrides.academicYear ?? '2025-26',
    criteria: overrides.criteria,
  };
}

// ─── generateEligibilityReport ──────────────────────────────────────────────

describe('PromotionService.generateEligibilityReport', () => {
  let service: PromotionService;

  beforeEach(() => {
    service = new PromotionService();
  });

  it('marks student DETAINED when attendancePct < 75', () => {
    // Arjun Reddy in mock data has attendancePct=68 → below 75
    const batch = service.generateEligibilityReport(
      makeDto({ criteria: { minAttendancePct: 75, minIaScore: 40, feeClearanceRequired: false } }),
    );
    const arjun = batch.students.find((s) => s.studentUsn === '1RV21CS002')!;
    expect(arjun.status).toBe('DETAINED');
    expect(arjun.failedCriteria).toContain('ATTENDANCE_LOW');
  });

  it('marks student DETAINED when iaScore < 40 (minIaScore threshold)', () => {
    // Farhan Sheikh has iaScore=34 which is < 40
    const batch = service.generateEligibilityReport(
      makeDto({ criteria: { minAttendancePct: 75, minIaScore: 40, feeClearanceRequired: false } }),
    );
    const farhan = batch.students.find((s) => s.studentUsn === '1RV21CS007')!;
    expect(farhan.status).toBe('DETAINED');
    expect(farhan.failedCriteria).toContain('IA_BELOW_MIN');
  });

  it('marks student DETAINED when feeClearanceRequired=true and fee not cleared', () => {
    // Bhavana Rao has feeCleared=false
    const batch = service.generateEligibilityReport(
      makeDto({
        criteria: { minAttendancePct: 75, minIaScore: 40, feeClearanceRequired: true },
      }),
    );
    const bhavana = batch.students.find((s) => s.studentUsn === '1RV21CS003')!;
    expect(bhavana.status).toBe('DETAINED');
    expect(bhavana.failedCriteria).toContain('FEE_PENDING');
  });

  it('does NOT mark FEE_PENDING when feeClearanceRequired=false, even if fee not cleared', () => {
    // With feeClearanceRequired=false, Bhavana's fee issue should be ignored
    const batch = service.generateEligibilityReport(
      makeDto({
        criteria: {
          minAttendancePct: 75,
          minIaScore: 40,
          feeClearanceRequired: false,
        },
      }),
    );
    const bhavana = batch.students.find((s) => s.studentUsn === '1RV21CS003')!;
    // Bhavana has 82% attendance and 65 IA → passes both non-fee criteria
    expect(bhavana.failedCriteria).not.toContain('FEE_PENDING');
    expect(bhavana.status).toBe('ELIGIBLE');
  });

  it('marks student ELIGIBLE when attendance ≥ 75, IA ≥ 40, and fee cleared', () => {
    // Priya Sharma: attendancePct=88, iaScore=72, feeCleared=true
    const batch = service.generateEligibilityReport(
      makeDto({
        criteria: { minAttendancePct: 75, minIaScore: 40, feeClearanceRequired: true },
      }),
    );
    const priya = batch.students.find((s) => s.studentUsn === '1RV21CS001')!;
    expect(priya.status).toBe('ELIGIBLE');
    expect(priya.failedCriteria).toHaveLength(0);
  });

  it('returns correct stats for total, eligible, detained, conditional', () => {
    const batch = service.generateEligibilityReport(
      makeDto({
        criteria: { minAttendancePct: 75, minIaScore: 40, feeClearanceRequired: true },
      }),
    );
    const { stats, students } = batch;
    expect(stats.total).toBe(students.length);
    expect(stats.eligible + stats.detained + stats.conditional).toBe(stats.total);
    expect(stats.promoted).toBe(0);
  });

  it('throws BadRequestException if a batch already exists for the same class+semester', () => {
    const dto = makeDto();
    service.generateEligibilityReport(dto);
    expect(() => service.generateEligibilityReport(dto)).toThrow();
  });

  it('sets toSemester = fromSemester + 1', () => {
    const dto = makeDto({ fromSemester: 5 });
    const batch = service.generateEligibilityReport(dto);
    expect(batch.toSemester).toBe(6);
  });

  it('applies custom minAttendancePct from criteria', () => {
    // With a lower threshold of 60%, Arjun (68%) should now pass attendance
    const batch = service.generateEligibilityReport(
      makeDto({
        criteria: { minAttendancePct: 60, minIaScore: 40, feeClearanceRequired: true },
      }),
    );
    const arjun = batch.students.find((s) => s.studentUsn === '1RV21CS002')!;
    expect(arjun.failedCriteria).not.toContain('ATTENDANCE_LOW');
  });
});

// ─── executeBatchPromotion ───────────────────────────────────────────────────

describe('PromotionService.executeBatchPromotion', () => {
  let service: PromotionService;

  beforeEach(() => {
    service = new PromotionService();
  });

  function generateAndGetBatch() {
    return service.generateEligibilityReport(
      makeDto({
        criteria: { minAttendancePct: 75, minIaScore: 40, feeClearanceRequired: true },
      }),
    );
  }

  it('promotes all ELIGIBLE and CONDITIONAL students', () => {
    const batch = generateAndGetBatch();
    const eligibleUsns = batch.students
      .filter((s) => s.status === 'ELIGIBLE' || s.status === 'CONDITIONAL')
      .map((s) => s.studentUsn);

    const result = service.executeBatchPromotion(batch.id, 'admin-1');

    expect(result.promoted.sort()).toEqual(eligibleUsns.sort());
  });

  it('leaves DETAINED students out of the promoted list', () => {
    const batch = generateAndGetBatch();
    const detainedUsns = batch.students
      .filter((s) => s.status === 'DETAINED')
      .map((s) => s.studentUsn);

    const result = service.executeBatchPromotion(batch.id, 'admin-1');

    expect(result.detained.sort()).toEqual(detainedUsns.sort());
    // detained students should not appear in promoted
    for (const usn of detainedUsns) {
      expect(result.promoted).not.toContain(usn);
    }
  });

  it('returns correct promoted and detained counts', () => {
    const batch = generateAndGetBatch();
    const expectedPromoted = batch.students.filter(
      (s) => s.status === 'ELIGIBLE' || s.status === 'CONDITIONAL',
    ).length;
    const expectedDetained = batch.students.filter((s) => s.status === 'DETAINED').length;

    const result = service.executeBatchPromotion(batch.id, 'admin-1');

    expect(result.promoted).toHaveLength(expectedPromoted);
    expect(result.detained).toHaveLength(expectedDetained);
  });

  it('marks batch as completed (promotedAt and promotedBy set)', () => {
    const batch = generateAndGetBatch();
    service.executeBatchPromotion(batch.id, 'admin-1');

    const refreshed = service.findById(batch.id);
    expect(refreshed.promotedAt).toBeTruthy();
    expect(refreshed.promotedBy).toBe('admin-1');
  });

  it('updates stats.promoted after execution', () => {
    const batch = generateAndGetBatch();
    const expectedPromoCount = batch.students.filter(
      (s) => s.status === 'ELIGIBLE' || s.status === 'CONDITIONAL',
    ).length;

    service.executeBatchPromotion(batch.id, 'admin-1');

    const refreshed = service.findById(batch.id);
    expect(refreshed.stats.promoted).toBe(expectedPromoCount);
  });

  it('throws BadRequestException if batch has already been promoted', () => {
    const batch = generateAndGetBatch();
    service.executeBatchPromotion(batch.id, 'admin-1');
    expect(() => service.executeBatchPromotion(batch.id, 'admin-1')).toThrow();
  });

  it('throws NotFoundException for an unknown batch id', () => {
    expect(() => service.executeBatchPromotion('bad-id', 'admin-1')).toThrow();
  });
});

// ─── overrideStudent ─────────────────────────────────────────────────────────

describe('PromotionService.overrideStudent', () => {
  let service: PromotionService;

  beforeEach(() => {
    service = new PromotionService();
  });

  it('changes a DETAINED student to CONDITIONAL with note and overriddenBy', () => {
    const batch = service.generateEligibilityReport(
      makeDto({
        criteria: { minAttendancePct: 75, minIaScore: 40, feeClearanceRequired: true },
      }),
    );

    // Arjun (1RV21CS002) is DETAINED due to attendance
    const updated = service.overrideStudent(batch.id, '1RV21CS002', {
      status: 'CONDITIONAL',
      note: 'Medical exemption approved by HOD',
      overriddenBy: 'hod-1',
    });

    const arjun = updated.students.find((s) => s.studentUsn === '1RV21CS002')!;
    expect(arjun.status).toBe('CONDITIONAL');
    expect(arjun.overrideNote).toBe('Medical exemption approved by HOD');
    expect(arjun.overriddenBy).toBe('hod-1');
  });

  it('refreshes batch stats after override', () => {
    const batch = service.generateEligibilityReport(
      makeDto({
        criteria: { minAttendancePct: 75, minIaScore: 40, feeClearanceRequired: true },
      }),
    );
    const detainedBefore = batch.stats.detained;

    service.overrideStudent(batch.id, '1RV21CS002', {
      status: 'CONDITIONAL',
      note: 'Exemption',
      overriddenBy: 'hod-1',
    });

    const refreshed = service.findById(batch.id);
    // DETAINED count should decrease by 1, CONDITIONAL count should increase by 1
    expect(refreshed.stats.detained).toBe(detainedBefore - 1);
    expect(refreshed.stats.conditional).toBeGreaterThan(0);
  });

  it('throws NotFoundException for a student USN not in the batch', () => {
    const batch = service.generateEligibilityReport(makeDto());
    expect(() =>
      service.overrideStudent(batch.id, 'NONEXISTENT-USN', {
        status: 'CONDITIONAL',
        note: 'Test',
        overriddenBy: 'admin',
      }),
    ).toThrow();
  });

  it('throws NotFoundException for an unknown batch id', () => {
    expect(() =>
      service.overrideStudent('bad-batch', '1RV21CS001', {
        status: 'CONDITIONAL',
        note: 'Test',
        overriddenBy: 'admin',
      }),
    ).toThrow();
  });

  it('throws BadRequestException when trying to override a completed batch', () => {
    const batch = service.generateEligibilityReport(makeDto());
    service.executeBatchPromotion(batch.id, 'admin-1');

    expect(() =>
      service.overrideStudent(batch.id, '1RV21CS001', {
        status: 'CONDITIONAL',
        note: 'Post-promotion override',
        overriddenBy: 'admin',
      }),
    ).toThrow();
  });
});

describe('findAll', () => {
  it('returns all batches including newly created ones', () => {
    const service = new PromotionService();
    const before = service.findAll().length;
    service.generateEligibilityReport(makeDto());
    expect(service.findAll().length).toBe(before + 1);
  });
});
