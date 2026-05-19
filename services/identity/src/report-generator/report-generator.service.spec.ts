import { InternalServerErrorException } from '@nestjs/common';
import { ReportGeneratorService } from './report-generator.service';

// ---------------------------------------------------------------------------
// Mock xlsx — must be hoisted before the module under test is imported
// ---------------------------------------------------------------------------
const mockBookNew = jest.fn().mockReturnValue({});
const mockAoaToSheet = jest.fn().mockReturnValue({});
const mockBookAppendSheet = jest.fn();
const mockXlsxWrite = jest.fn().mockReturnValue(Buffer.from('xlsx-bytes'));

jest.mock('xlsx', () => ({
  utils: {
    book_new: (...args: unknown[]) => mockBookNew(...args),
    aoa_to_sheet: (...args: unknown[]) => mockAoaToSheet(...args),
    book_append_sheet: (...args: unknown[]) => mockBookAppendSheet(...args),
  },
  write: (...args: unknown[]) => mockXlsxWrite(...args),
}));

// ---------------------------------------------------------------------------
// DB mock (same pattern as chatbot.service.spec.ts)
// ---------------------------------------------------------------------------
const mockQuery = jest.fn();
const mockDb = { query: mockQuery } as any;

// ---------------------------------------------------------------------------
// global fetch mock
// ---------------------------------------------------------------------------
const fakeZipBuffer = new ArrayBuffer(8);
const mockFetchArrayBuffer = jest.fn().mockResolvedValue(fakeZipBuffer);
const mockFetchText = jest.fn().mockResolvedValue('');

function makeFetchResponse(ok = true, status = 200) {
  return {
    ok,
    status,
    arrayBuffer: mockFetchArrayBuffer,
    text: mockFetchText,
  };
}

const mockFetch = jest.fn().mockResolvedValue(makeFetchResponse());
global.fetch = mockFetch as unknown as typeof fetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeService(db: typeof mockDb | null = mockDb) {
  return new ReportGeneratorService(db as any);
}

// One student row returned by the big attendance SQL — exercises all branches
// of the student-grouping loop (with subject_name present).
const studentRowWithSubject = {
  student_name: 'Alice',
  usn: '1RV21CS001',
  father_name: 'Bob',
  parent_email: 'bob@example.com',
  counsellor_email: '',
  remarks: '',
  subject_name: 'DBMS',
  test_marks: 18,
  assignment_marks: 5,
  classes_held: 40,
  classes_attended: 32,
};

// A row for the same student but without a subject_name — covers the
// `if (r['subject_name'])` false-branch inside buildAttendanceExcel.
const studentRowNoSubject = {
  ...studentRowWithSubject,
  subject_name: null,
};

// ---------------------------------------------------------------------------
describe('ReportGeneratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default mock implementations after each test
    mockXlsxWrite.mockReturnValue(Buffer.from('xlsx-bytes'));
    mockFetchArrayBuffer.mockResolvedValue(fakeZipBuffer);
    mockFetchText.mockResolvedValue('');
    mockFetch.mockResolvedValue(makeFetchResponse());
  });

  // =========================================================================
  // generate() — happy path
  // =========================================================================
  describe('generate()', () => {
    it('inserts PENDING row, builds xlsx, calls fetch, updates DONE row, returns Buffer', async () => {
      const svc = makeService();

      // 1) INSERT PENDING → returns genId
      // 2) buildAttendanceExcel → student + attendance query
      // 3) UPDATE DONE
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-001' }])
        .mockResolvedValueOnce([studentRowWithSubject])
        .mockResolvedValueOnce([]);

      const result = await svc.generate(
        'ATTENDANCE',
        { department: 'Computer Science & Engineering', semester: 5, section: 'A', testChoice: 'CIE-1' },
        'user-1',
      );

      // Must return { buffer, mimeType, fileExtension }
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.mimeType).toBe('application/zip');
      expect(result.fileExtension).toBe('zip');

      // INSERT PENDING called first
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('PENDING'),
        ['ATTENDANCE', 'user-1', expect.stringContaining('"semester":5')],
      );

      // fetch called with POST to report engine
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/generate-from-excel'),
        expect.objectContaining({ method: 'POST' }),
      );

      // UPDATE DONE called with genId and byte length
      expect(mockQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("'DONE'"),
        ['gen-001', fakeZipBuffer.byteLength],
      );

      // xlsx utils all exercised
      expect(mockBookNew).toHaveBeenCalled();
      expect(mockAoaToSheet).toHaveBeenCalled();
      expect(mockBookAppendSheet).toHaveBeenCalled();
      expect(mockXlsxWrite).toHaveBeenCalledWith(expect.anything(), { bookType: 'xlsx', type: 'buffer' });
    });

    it('handles student row with no subject_name (covers the if(subject_name) false-branch)', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-002' }])
        .mockResolvedValueOnce([studentRowNoSubject])
        .mockResolvedValueOnce([]);

      const result = await svc.generate('ATTENDANCE', {}, 'user-2');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('handles empty student rows (maxSubjects falls back to 1)', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-003' }])
        .mockResolvedValueOnce([])          // no students
        .mockResolvedValueOnce([]);

      const result = await svc.generate('ATTENDANCE', { semester: 3 }, 'user-3');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('generates correct BRANCH_MAP and SEMESTER_LABELS for known department/semester', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-004' }])
        .mockResolvedValueOnce([studentRowWithSubject])
        .mockResolvedValueOnce([]);

      await svc.generate('ATTENDANCE', {
        department: 'Information Science & Engineering',
        semester: 2,
        testChoice: 'CIE-2',
        submissionDate: '2026-04-30',
        note: 'Mid-sem',
      }, 'user-4');

      // fetch body should carry the mapped branch and semester label
      const body: FormData = mockFetch.mock.calls[0][1].body;
      expect(body.get('branch_choice')).toBe('INFORMATION SCIENCE & ENGINEERING');
      expect(body.get('semester')).toBe('II Semester BE');
      expect(body.get('test_choice')).toBe('CIE-2');
      expect(body.get('submission_date')).toBe('2026-04-30');
      expect(body.get('note')).toBe('Mid-sem');
    });

    it('falls back to uppercased department when not in BRANCH_MAP', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-005' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await svc.generate('ATTENDANCE', { department: 'Civil Engineering', semester: 6 }, 'user-5');

      const body: FormData = mockFetch.mock.calls[0][1].body;
      expect(body.get('branch_choice')).toBe('CIVIL ENGINEERING');
    });

    it('uses default semester label fallback for unmapped semester number', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-006' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await svc.generate('ATTENDANCE', { semester: 10 }, 'user-6');

      const body: FormData = mockFetch.mock.calls[0][1].body;
      expect(body.get('semester')).toBe('10 Semester BE');
    });

    it('when db is null → throws InternalServerErrorException', async () => {
      const svc = makeService(null);
      await expect(svc.generate('ATTENDANCE', {}, 'user-x')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('when db is null → error message is "Database not configured"', async () => {
      const svc = makeService(null);
      await expect(svc.generate('ATTENDANCE', {}, 'user-x')).rejects.toThrow(
        'Database not configured',
      );
    });

    it('when fetch to report-engine returns non-ok → falls back to raw XLSX (engine errors are swallowed)', async () => {
      // Production now treats report-engine 5xx as "engine unreachable" and
      // returns the raw XLSX so the user still gets a working file. The
      // FAILED row is NOT written, and DONE is recorded as normal.
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-007' }])
        .mockResolvedValueOnce([studentRowWithSubject])
        .mockResolvedValueOnce([]); // UPDATE DONE

      mockFetchText.mockResolvedValueOnce('Bad Gateway');
      mockFetch.mockResolvedValueOnce(makeFetchResponse(false, 502));

      const result = await svc.generate('ATTENDANCE', {}, 'user-7');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      // KAN-35: engine fallback now serves a proper .xlsx with the right
      // mime so Excel actually opens the file (was application/zip before).
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.fileExtension).toBe('xlsx');
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("'FAILED'"),
        expect.anything(),
      );
    });

    it('when fetch itself throws (network error) → falls back to raw XLSX', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-008' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // UPDATE DONE

      mockFetch.mockRejectedValueOnce(new Error('network timeout'));

      const result = await svc.generate('ATTENDANCE', {}, 'user-8');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("'FAILED'"),
        expect.anything(),
      );
    });

    it('when fetch returns non-ok and res.text() throws → still falls back to raw XLSX (engine errors swallowed)', async () => {
      // The .catch(() => '') on res.text() still runs, but the resulting
      // InternalServerErrorException is swallowed by the outer try/catch so
      // the user gets a raw XLSX rather than a 500.
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-textfail' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const textThrowingResponse = {
        ok: false,
        status: 503,
        text: jest.fn().mockRejectedValueOnce(new Error('body read error')),
        arrayBuffer: jest.fn(),
      };
      mockFetch.mockResolvedValueOnce(textThrowingResponse);

      const result = await svc.generate('ATTENDANCE', {}, 'user-textfail');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('when fetch returns non-ok and res.text() throws → engine error message includes 503', async () => {
      // Even though the response is swallowed by callReportEngine, we can
      // assert that the engine error path was taken by verifying the warn
      // logger received a message with the status code.
      const svc = makeService();
      const warnSpy = jest.spyOn((svc as any).logger, 'warn');
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-textfail2' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const textThrowingResponse2 = {
        ok: false,
        status: 503,
        text: jest.fn().mockRejectedValueOnce(new Error('body read error')),
        arrayBuffer: jest.fn(),
      };
      mockFetch.mockResolvedValueOnce(textThrowingResponse2);

      await svc.generate('ATTENDANCE', {}, 'user-textfail2');
      const calls = warnSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((m) => m.includes('503'))).toBe(true);
    });

    // -----------------------------------------------------------------------
    // AbortController — fetch receives the abort signal and rejects.
    // -----------------------------------------------------------------------
    it('when AbortController timeout fires → fetch rejects with AbortError, falls back to raw XLSX', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-abort' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // UPDATE DONE

      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      mockFetch.mockImplementationOnce((_url: string, _opts: { signal: AbortSignal }) => {
        return Promise.reject(abortError);
      });

      // Engine errors are now swallowed — generate resolves with raw XLSX.
      const result = await svc.generate('ATTENDANCE', {}, 'user-abort');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("'FAILED'"),
        expect.anything(),
      );
    });

    // -----------------------------------------------------------------------
    // setTimeout callback (line 261): the `() => controller.abort()` arrow
    // function inside setTimeout must execute to reach 100% function coverage.
    // We use jest.useFakeTimers() + jest.runAllTimersAsync() (Jest 29 API)
    // which fires timers and flushes async microtasks in one call.
    // IMPORTANT: attach .catch before runAllTimersAsync to avoid an
    // unhandled-rejection warning from the interim rejection propagation.
    // -----------------------------------------------------------------------
    it('setTimeout abort callback (line 261) fires → controller.abort() is called and result falls back to raw XLSX', async () => {
      jest.useFakeTimers();

      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-cb-abort' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // UPDATE DONE

      // fetch returns a Promise that rejects as soon as the AbortSignal fires.
      mockFetch.mockImplementationOnce((_url: string, opts: { signal: AbortSignal }) => {
        return new Promise<never>((_res, rej) => {
          opts.signal.addEventListener('abort', () =>
            rej(new DOMException('Aborted by timer', 'AbortError')),
          );
        });
      });

      const generatePromise = svc.generate('ATTENDANCE', {}, 'user-cb-abort');

      // Fire the 30-second timeout and flush all resulting microtasks.
      await jest.runAllTimersAsync();

      // Engine errors are swallowed — generate resolves with a Buffer.
      const result = await generatePromise;
      expect(Buffer.isBuffer(result.buffer)).toBe(true);

      jest.useRealTimers();
    }, 15_000);

    it('when error is thrown before genId is set (INSERT returns undefined) → re-throws without UPDATE FAILED', async () => {
      // The INSERT query resolves but returns undefined (not an array),
      // so `ins[0].id` throws a TypeError. genId was never set, so the
      // catch block MUST NOT call UPDATE FAILED.
      const svc = makeService();
      // Returning undefined (not an array) mimics a broken DB driver response.
      mockQuery.mockResolvedValueOnce(undefined);

      await expect(svc.generate('ATTENDANCE', {}, 'user-9')).rejects.toThrow(TypeError);

      // Only the one INSERT query — no subsequent UPDATE FAILED
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('when UPDATE DONE itself throws after engine fallback → DB error propagates and FAILED-update is best-effort', async () => {
      // Engine errors are swallowed (raw XLSX returned), then UPDATE DONE
      // runs. If UPDATE DONE rejects, the error propagates to the outer
      // catch which calls UPDATE FAILED with .catch(...). Stub all four
      // queries so the .catch chain has a real Promise to attach to.
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-010' }])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('update done — propagates'))
        .mockResolvedValueOnce([]); // UPDATE FAILED (best-effort)

      mockFetch.mockRejectedValueOnce(new Error('primary error'));

      await expect(svc.generate('ATTENDANCE', {}, 'user-10')).rejects.toThrow('update done — propagates');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'FAILED'"),
        ['gen-010', expect.stringContaining('update done')],
      );
    });

    it('student with a second subject not in subjectNames triggers dataRow fallback branch', async () => {
      // Two students: student A has DBMS + OS, student B has only DBMS.
      // When building the data row for student B, the `find` for OS returns
      // undefined → exercises the `else { row.push('', 0, 0, 0, 0) }` branch.
      const svc = makeService();

      const studentA_DBMS = { ...studentRowWithSubject, usn: '1RV21CS001', subject_name: 'DBMS' };
      const studentA_OS   = { ...studentRowWithSubject, usn: '1RV21CS001', subject_name: 'OS' };
      const studentB_DBMS = { ...studentRowWithSubject, usn: '1RV21CS002', student_name: 'Bob', subject_name: 'DBMS' };

      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-011' }])
        .mockResolvedValueOnce([studentA_DBMS, studentA_OS, studentB_DBMS])
        .mockResolvedValueOnce([]);

      const result = await svc.generate('ATTENDANCE', {}, 'user-11');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);

      // aoa_to_sheet is called with a 2-D array; find the data row for student B
      const aoaCall = mockAoaToSheet.mock.calls[0][0] as unknown[][];
      const studentBRow = aoaCall.find(r => Array.isArray(r) && r[1] === '1RV21CS002');
      expect(studentBRow).toBeDefined();
      // OS slot for student B should be '' (placeholder)
      expect(studentBRow).toContain('');
    });

    it('covers Master of Computer Applications branch mapping', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-mca' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await svc.generate('ATTENDANCE', { department: 'Master of Computer Applications' }, 'user-mca');

      const body: FormData = mockFetch.mock.calls[0][1].body;
      expect(body.get('branch_choice')).toBe('MASTER OF COMPUTER APPLICATIONS');
    });

    // Covers all remaining SEMESTER_LABELS entries
    it.each([
      [1, 'I Semester BE'],
      [3, 'III Semester BE'],
      [4, 'IV Semester BE'],
      [6, 'VI Semester BE'],
      [7, 'VII Semester BE'],
      [8, 'VIII Semester BE'],
    ])('semester %i maps to "%s"', async (sem, label) => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: `gen-sem-${sem}` }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await svc.generate('ATTENDANCE', { semester: sem }, `user-sem-${sem}`);

      const body: FormData = mockFetch.mock.calls[0][1].body;
      expect(body.get('semester')).toBe(label);
    });

    it('covers Electronics & Communication Engineering branch mapping', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-ece' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      await svc.generate('ATTENDANCE', { department: 'Electronics & Communication Engineering' }, 'user-ece');
      const body: FormData = mockFetch.mock.calls[0][1].body;
      expect(body.get('branch_choice')).toBe('ELECTRONICS & COMMUNICATION ENGINEERING');
    });

    it('covers Mechanical Engineering branch mapping', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-mech' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      await svc.generate('ATTENDANCE', { department: 'Mechanical Engineering' }, 'user-mech');
      const body: FormData = mockFetch.mock.calls[0][1].body;
      expect(body.get('branch_choice')).toBe('MECHANICAL ENGINEERING');
    });

    it('covers Computer Science & Engineering branch mapping', async () => {
      const svc = makeService();
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-cse' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      await svc.generate('ATTENDANCE', { department: 'Computer Science & Engineering' }, 'user-cse');
      const body: FormData = mockFetch.mock.calls[0][1].body;
      expect(body.get('branch_choice')).toBe('COMPUTER SCIENCE & ENGINEERING');
    });

    it('covers ?? null-fallback branches: null student_name/father_name/parent_email/counsellor_email', async () => {
      // These rows have null for the nullable string fields — exercises the
      // `?? ''` right-hand branches for String() coercions in buildAttendanceExcel.
      const svc = makeService();
      const nullFieldRow = {
        usn: '1RV21CS099',
        student_name: null,
        father_name: null,
        parent_email: null,
        counsellor_email: null,
        subject_name: 'MATHS',
        test_marks: null,
        assignment_marks: null,
        classes_held: null,
        classes_attended: null,
      };
      mockQuery
        .mockResolvedValueOnce([{ id: 'gen-null' }])
        .mockResolvedValueOnce([nullFieldRow])
        .mockResolvedValueOnce([]);

      const result = await svc.generate('ATTENDANCE', {}, 'user-null');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);

      // Verify aoa_to_sheet received the data row for this student.
      // Row structure: [name, usn, father, parentEmail, counsellorEmail, remarks, subjectName, test, assign, held, attended]
      const aoaCall = mockAoaToSheet.mock.calls[0][0] as unknown[][];
      // Data rows start at index 3 (after pandasHeaderRow, subjectHeaderRow, blankRow)
      const dataRow = aoaCall.find(r => Array.isArray(r) && r[1] === '1RV21CS099');
      expect(dataRow).toBeDefined();
      // name: String(null) = 'null' in JS — this is what the service actually produces via String()
      expect(dataRow![1]).toBe('1RV21CS099');
      // test_marks null → Number(null) = 0
      expect(dataRow![7]).toBe(0);
    });
  });

  // =========================================================================
  // getHistory()
  // =========================================================================
  describe('getHistory()', () => {
    it('returns rows from DB for the requested user', async () => {
      const svc = makeService();
      const rows = [
        { id: 'r1', reportType: 'ATTENDANCE', requestedBy: 'user-1', status: 'DONE', createdAt: '2026-04-01' },
      ];
      mockQuery.mockResolvedValueOnce(rows);

      const result = await svc.getHistory('user-1');
      expect(result).toEqual(rows);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('requested_by = $1'),
        ['user-1'],
      );
    });

    it('returns [] when db is null', async () => {
      const svc = makeService(null);
      const result = await svc.getHistory('user-1');
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getAllHistory()
  // =========================================================================
  describe('getAllHistory()', () => {
    it('returns all rows from DB', async () => {
      const svc = makeService();
      const rows = [
        { id: 'r1', reportType: 'ATTENDANCE', requestedBy: 'user-1', status: 'DONE', createdAt: '2026-04-01' },
        { id: 'r2', reportType: 'ATTENDANCE', requestedBy: 'user-2', status: 'PENDING', createdAt: '2026-04-02' },
      ];
      mockQuery.mockResolvedValueOnce(rows);

      const result = await svc.getAllHistory();
      expect(result).toEqual(rows);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC LIMIT 50'),
      );
    });

    it('returns [] when db is null', async () => {
      const svc = makeService(null);
      const result = await svc.getAllHistory();
      expect(result).toEqual([]);
    });
  });
});
