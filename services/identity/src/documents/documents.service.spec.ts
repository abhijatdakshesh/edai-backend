import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { DocumentsService, DocType } from './documents.service';
import { EventsGateway } from '../events/events.gateway';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDocRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'doc-uuid-1',
    doc_number: 'DOC-1000',
    student_usn: '1RV21CS001',
    student_name: 'Arjun Sharma',
    doc_type: 'BONAFIDE',
    purpose: 'Bank loan',
    purpose_detail: null,
    status: 'PENDING',
    ai_body: null,
    signed_token: null,
    requested_at: '2026-04-27T10:00:00Z',
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    expires_at: null,
    consent_given: true,
    ...overrides,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockDataSource = { query: mockQuery };

const mockEvents = { emitDocumentStatusChanged: jest.fn() };

async function buildService(): Promise<DocumentsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DocumentsService,
      { provide: getDataSourceToken(), useValue: mockDataSource },
      { provide: EventsGateway, useValue: mockEvents },
    ],
  }).compile();
  return module.get<DocumentsService>(DocumentsService);
}

async function buildServiceNoDB(): Promise<DocumentsService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DocumentsService,
      { provide: EventsGateway, useValue: mockEvents },
    ],
  }).compile();
  return module.get<DocumentsService>(DocumentsService);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeAll(() => {
    process.env['ANTHROPIC_API_KEY'] = 'test-key-ci';
  });

  afterAll(() => {
    delete process.env['ANTHROPIC_API_KEY'];
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await buildService();
  });

  // ── requestDocument ──────────────────────────────────────────────────────

  describe('requestDocument', () => {
    const dto = {
      docType: 'BONAFIDE' as DocType,
      purpose: 'Bank loan',
      studentName: 'Arjun Sharma',
      consentGiven: true,
    };

    it('inserts row and emits event', async () => {
      mockQuery.mockResolvedValueOnce([makeDocRow()]);
      const result = await service.requestDocument('1RV21CS001', dto);
      expect(result.id).toBe('doc-uuid-1');
      expect(mockEvents.emitDocumentStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING', studentUsn: '1RV21CS001' }),
      );
    });

    it('throws BadRequest when consent not given', async () => {
      await expect(
        service.requestDocument('1RV21CS001', { ...dto, consentGiven: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sanitizes purpose_detail — strips backticks and angle brackets', async () => {
      mockQuery.mockResolvedValueOnce([makeDocRow()]);
      await service.requestDocument('1RV21CS001', {
        ...dto,
        purposeDetail: '`<script>alert(1)</script>`',
      });
      const callArgs = mockQuery.mock.calls[0] as [string, unknown[]];
      const sanitized = callArgs[1][4] as string;
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('`');
    });

    it('truncates purpose_detail to 200 chars', async () => {
      mockQuery.mockResolvedValueOnce([makeDocRow()]);
      const long = 'x'.repeat(300);
      await service.requestDocument('1RV21CS001', { ...dto, purposeDetail: long });
      const callArgs = mockQuery.mock.calls[0] as [string, unknown[]];
      const sanitized = callArgs[1][4] as string;
      expect(sanitized.length).toBeLessThanOrEqual(200);
    });

    it('throws InternalServerError when no DB', async () => {
      const noDbService = await buildServiceNoDB();
      await expect(noDbService.requestDocument('1RV21CS001', dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── getMyRequests ────────────────────────────────────────────────────────

  describe('getMyRequests', () => {
    it('returns mapped documents for student', async () => {
      mockQuery.mockResolvedValueOnce([makeDocRow(), makeDocRow({ id: 'doc-uuid-2' })]);
      const result = await service.getMyRequests('1RV21CS001');
      expect(result).toHaveLength(2);
      expect(result[0].studentUsn).toBe('1RV21CS001');
    });

    it('enforces WHERE student_usn = $1 (IDOR guard)', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getMyRequests('1RV21CS001');
      const callArgs = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(callArgs[0]).toContain('WHERE student_usn = $1');
      expect(callArgs[1]).toEqual(['1RV21CS001']);
    });

    it('returns [] when no DB', async () => {
      const noDbService = await buildServiceNoDB();
      expect(await noDbService.getMyRequests('1RV21CS001')).toEqual([]);
    });
  });

  // ── getRequest ───────────────────────────────────────────────────────────

  describe('getRequest', () => {
    it('returns doc when id + usn match', async () => {
      mockQuery.mockResolvedValueOnce([makeDocRow()]);
      const result = await service.getRequest('doc-uuid-1', '1RV21CS001');
      expect(result.id).toBe('doc-uuid-1');
    });

    it('throws NotFoundException when no rows (IDOR protection)', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(service.getRequest('doc-uuid-1', 'DIFFERENT-USN')).rejects.toThrow(NotFoundException);
    });

    it('passes both id and usn as params (IDOR guard)', async () => {
      mockQuery.mockResolvedValueOnce([makeDocRow()]);
      await service.getRequest('doc-uuid-1', '1RV21CS001');
      const callArgs = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(callArgs[1]).toEqual(['doc-uuid-1', '1RV21CS001']);
    });

    it('throws InternalServerError when no DB', async () => {
      const noDbService = await buildServiceNoDB();
      await expect(noDbService.getRequest('doc-uuid-1', '1RV21CS001')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── getAllPending ─────────────────────────────────────────────────────────

  describe('getAllPending', () => {
    it('returns pending docs', async () => {
      mockQuery.mockResolvedValueOnce([makeDocRow(), makeDocRow({ id: 'doc-uuid-2' })]);
      const result = await service.getAllPending();
      expect(result).toHaveLength(2);
    });

    it('returns [] when no DB', async () => {
      const noDbService = await buildServiceNoDB();
      expect(await noDbService.getAllPending()).toEqual([]);
    });
  });

  // ── approveRequest ───────────────────────────────────────────────────────

  describe('approveRequest', () => {
    it('throws ConflictException when no rows from optimistic lock UPDATE', async () => {
      mockQuery.mockResolvedValueOnce([]); // optimistic lock returns 0 rows
      await expect(service.approveRequest('doc-uuid-1', 'admin-usn')).rejects.toThrow(ConflictException);
    });

    it('throws InternalServerError when no DB', async () => {
      const noDbService = await buildServiceNoDB();
      await expect(noDbService.approveRequest('doc-uuid-1', 'admin-usn')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('updates ai_body and signed_token on success', async () => {
      mockQuery
        .mockResolvedValueOnce([makeDocRow({ status: 'APPROVED', reviewed_at: new Date().toISOString() })])
        .mockResolvedValueOnce([{ id: 'doc-uuid-1' }]); // second UPDATE returns row on success

      jest.spyOn(service, 'generateAiBody').mockResolvedValueOnce('AI body text');

      const result = await service.approveRequest('doc-uuid-1', 'admin-usn');
      expect(result.aiBody).toBe('AI body text');
      expect(result.signedToken).not.toBeNull();
    });

    it('emits document:status-changed on success', async () => {
      mockQuery
        .mockResolvedValueOnce([makeDocRow({ status: 'APPROVED', reviewed_at: new Date().toISOString() })])
        .mockResolvedValueOnce([{ id: 'doc-uuid-1' }]); // second UPDATE returns row on success

      jest.spyOn(service, 'generateAiBody').mockResolvedValueOnce('AI body text');

      await service.approveRequest('doc-uuid-1', 'admin-usn');
      expect(mockEvents.emitDocumentStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'APPROVED' }),
      );
    });
  });

  // ── rejectRequest ─────────────────────────────────────────────────────────

  describe('rejectRequest', () => {
    it('rejects with reason', async () => {
      mockQuery.mockResolvedValueOnce([makeDocRow({ status: 'REJECTED', rejection_reason: 'Insufficient info' })]);
      const result = await service.rejectRequest('doc-uuid-1', 'admin-usn', 'Insufficient info');
      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('Insufficient info');
    });

    it('throws ConflictException when no longer pending', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(service.rejectRequest('doc-uuid-1', 'admin-usn', 'reason')).rejects.toThrow(ConflictException);
    });

    it('throws InternalServerError when no DB', async () => {
      const noDbService = await buildServiceNoDB();
      await expect(noDbService.rejectRequest('doc-uuid-1', 'admin-usn', 'reason')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── revokeDocument ────────────────────────────────────────────────────────

  describe('revokeDocument', () => {
    it('revokes approved document', async () => {
      mockQuery.mockResolvedValueOnce([makeDocRow({ status: 'REVOKED' })]);
      const result = await service.revokeDocument('doc-uuid-1', 'admin-usn');
      expect(result.status).toBe('REVOKED');
    });

    it('throws NotFoundException when doc not found/approved', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(service.revokeDocument('doc-uuid-1', 'admin-usn')).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerError when no DB', async () => {
      const noDbService = await buildServiceNoDB();
      await expect(noDbService.revokeDocument('doc-uuid-1', 'admin-usn')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── verifyDocument ────────────────────────────────────────────────────────

  describe('verifyDocument', () => {
    it('returns valid=true for approved non-expired doc', async () => {
      const expiresAt = new Date(Date.now() + 86400000).toISOString();
      mockQuery.mockResolvedValueOnce([{
        id: 'doc-uuid-1',
        doc_type: 'BONAFIDE',
        student_name: 'Arjun Sharma',
        reviewed_at: new Date().toISOString(),
        expires_at: expiresAt,
        status: 'APPROVED',
      }]);
      const result = await service.verifyDocument('doc-uuid-1');
      expect(result?.valid).toBe(true);
    });

    it('returns valid=false for expired doc', async () => {
      const expiresAt = new Date(Date.now() - 86400000).toISOString();
      mockQuery.mockResolvedValueOnce([{
        id: 'doc-uuid-1',
        doc_type: 'BONAFIDE',
        student_name: 'Arjun Sharma',
        reviewed_at: new Date().toISOString(),
        expires_at: expiresAt,
        status: 'APPROVED',
      }]);
      const result = await service.verifyDocument('doc-uuid-1');
      expect(result?.valid).toBe(false);
    });

    it('returns valid=false for revoked doc', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'doc-uuid-1',
        doc_type: 'BONAFIDE',
        student_name: 'Arjun Sharma',
        reviewed_at: new Date().toISOString(),
        expires_at: null,
        status: 'REVOKED',
      }]);
      const result = await service.verifyDocument('doc-uuid-1');
      expect(result?.valid).toBe(false);
    });

    it('returns null when doc not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      expect(await service.verifyDocument('nonexistent-uuid')).toBeNull();
    });

    it('returns null when no DB', async () => {
      const noDbService = await buildServiceNoDB();
      expect(await noDbService.verifyDocument('doc-uuid-1')).toBeNull();
    });

    it('masks student name', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'doc-uuid-1',
        doc_type: 'BONAFIDE',
        student_name: 'Arjun Sharma',
        reviewed_at: new Date().toISOString(),
        expires_at: null,
        status: 'APPROVED',
      }]);
      const result = await service.verifyDocument('doc-uuid-1');
      expect(result?.studentName).not.toBe('Arjun Sharma');
      expect(result?.studentName).toContain('***');
    });
  });

  // ── generatePdf ───────────────────────────────────────────────────────────

  describe('generatePdf', () => {
    it('throws UnauthorizedException for invalid token', async () => {
      await expect(service.generatePdf('doc-uuid-1', 'bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token sub mismatches docId', async () => {
      const token = jwt.sign(
        { sub: 'different-uuid', usn: '1RV21CS001' },
        process.env['JWT_SECRET'] ?? 'edai-dev-secret-change-in-production',
        { expiresIn: '1h' },
      );
      await expect(service.generatePdf('doc-uuid-1', token)).rejects.toThrow(UnauthorizedException);
    });

    it('throws NotFoundException when doc not found/approved', async () => {
      const token = service.signDownloadToken('doc-uuid-1', '1RV21CS001');
      mockQuery.mockResolvedValueOnce([]); // no approved doc
      await expect(service.generatePdf('doc-uuid-1', token)).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerError when no DB', async () => {
      const noDbService = await buildServiceNoDB();
      const token = noDbService.signDownloadToken('doc-uuid-1', '1RV21CS001');
      await expect(noDbService.generatePdf('doc-uuid-1', token)).rejects.toThrow(InternalServerErrorException);
    });

    it('returns a PDF Buffer for valid approved doc', async () => {
      const token = service.signDownloadToken('doc-uuid-1', '1RV21CS001');
      mockQuery.mockResolvedValueOnce([
        makeDocRow({
          status: 'APPROVED',
          ai_body: 'This is a bonafide certificate.',
          reviewed_at: new Date().toISOString(),
          signed_token: token,
        }),
      ]);
      const result = await service.generatePdf('doc-uuid-1', token);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    }, 15000);
  });

  // ── generateAiBody ────────────────────────────────────────────────────────

  describe('generateAiBody', () => {
    it('returns template when AI throws', async () => {
      jest.spyOn(service['anthropic'].messages, 'create').mockRejectedValueOnce(new Error('API error'));
      const result = await service.generateAiBody('BONAFIDE', '1RV21CS001', 'Arjun Sharma', 'Bank loan', null);
      expect(result).toContain('Arjun Sharma');
      expect(result).toContain('1RV21CS001');
    });

    it('returns template text when AI returns empty', async () => {
      jest.spyOn(service['anthropic'].messages, 'create').mockResolvedValueOnce({
        content: [{ type: 'text', text: '' }],
      } as never);
      const result = await service.generateAiBody('BONAFIDE', '1RV21CS001', 'Arjun Sharma', 'Bank loan', null);
      expect(result).toContain('Arjun Sharma');
    });

    it('handles all doc types', async () => {
      jest.spyOn(service['anthropic'].messages, 'create').mockRejectedValue(new Error('no ai'));
      for (const docType of ['BONAFIDE', 'ATTENDANCE_CERT', 'FEE_RECEIPT', 'COURSE_COMPLETION'] as DocType[]) {
        const result = await service.generateAiBody(docType, '1RV21CS001', 'Arjun Sharma', 'purpose', null);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(10);
      }
    });
  });

  // ── maskName — short parts and empty string ──────────────────────────────

  describe('maskName — via verifyDocument()', () => {
    it('returns short name parts (≤ 2 chars) verbatim — not masked', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'doc-uuid-1',
        doc_type: 'BONAFIDE',
        student_name: 'A Kumar',
        reviewed_at: new Date().toISOString(),
        expires_at: null,
        status: 'APPROVED',
      }]);
      const result = await service.verifyDocument('doc-uuid-1');
      expect(result?.studentName).toContain('***');
      expect(result?.studentName).toContain('A');
    });

    it('returns *** for empty student name', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'doc-uuid-1',
        doc_type: 'BONAFIDE',
        student_name: '',
        reviewed_at: new Date().toISOString(),
        expires_at: null,
        status: 'APPROVED',
      }]);
      const result = await service.verifyDocument('doc-uuid-1');
      expect(result?.studentName).toBe('***');
    });

    it('falls back to raw doc_type string when not in DOC_LABEL (unknown type)', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'doc-uuid-1',
        doc_type: 'LEGACY_CERT',
        student_name: 'Arjun Sharma',
        reviewed_at: new Date().toISOString(),
        expires_at: null,
        status: 'APPROVED',
      }]);
      const result = await service.verifyDocument('doc-uuid-1');
      expect(result?.docType).toBe('LEGACY_CERT');
    });
  });

  // ── generateAiBody — non-Error throw and non-text content ────────────────

  describe('generateAiBody() — edge cases', () => {
    it('handles non-Error thrown value (string) in AI call', async () => {
      jest.spyOn(service['anthropic'].messages, 'create').mockRejectedValueOnce('string-error');
      const result = await service.generateAiBody('BONAFIDE', 'USN001', 'Test Student', 'Bank loan', null);
      expect(result).toContain('Test Student');
    });

    it('returns template when AI returns non-text content type', async () => {
      jest.spyOn(service['anthropic'].messages, 'create').mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'tu1', name: 'fn', input: {} }],
      } as never);
      const result = await service.generateAiBody('BONAFIDE', 'USN001', 'Arjun Kumar', 'Bank loan', null);
      expect(result).toContain('Arjun Kumar');
    });
  });

  // ── generatePdf — null reviewedAt and null aiBody ──────────────────────

  describe('generatePdf() — null aiBody and reviewedAt', () => {
    it('generates PDF even when reviewedAt is null and aiBody is null', async () => {
      const token = service.signDownloadToken('doc-null-1', '1RV21CS001');
      mockQuery.mockResolvedValueOnce([
        makeDocRow({
          id: 'doc-null-1',
          status: 'APPROVED',
          ai_body: null,
          reviewed_at: null,
          signed_token: token,
        }),
      ]);
      const result = await service.generatePdf('doc-null-1', token);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    }, 15000);
  });

  // ── signDownloadToken ─────────────────────────────────────────────────────

  describe('signDownloadToken', () => {
    it('produces a verifiable JWT with sub = docId', () => {
      const token = service.signDownloadToken('doc-uuid-1', '1RV21CS001');
      const payload = jwt.decode(token) as Record<string, unknown>;
      expect(payload['sub']).toBe('doc-uuid-1');
      expect(payload['usn']).toBe('1RV21CS001');
    });

    it('includes a unique jti to prevent token reuse attacks', () => {
      const t1 = service.signDownloadToken('doc-uuid-1', '1RV21CS001');
      const t2 = service.signDownloadToken('doc-uuid-1', '1RV21CS001');
      const p1 = jwt.decode(t1) as Record<string, unknown>;
      const p2 = jwt.decode(t2) as Record<string, unknown>;
      expect(p1['jti']).not.toBe(p2['jti']);
    });
  });
});
