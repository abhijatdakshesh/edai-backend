import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService, DocumentRequest, DocType, DocStatus } from './documents.service';
import { EventsGateway } from '../events/events.gateway';

function makeDoc(overrides: Partial<DocumentRequest> = {}): DocumentRequest {
  return {
    id: 'doc-uuid-1',
    docNumber: 'DOC-1000',
    studentUsn: '1RV21CS001',
    studentName: 'Arjun Sharma',
    docType: 'BONAFIDE' as DocType,
    purpose: 'Bank loan',
    purposeDetail: null,
    status: 'PENDING' as DocStatus,
    aiBody: null,
    signedToken: null,
    requestedAt: '2026-04-27T10:00:00Z',
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    expiresAt: null,
    consentGiven: true,
    ...overrides,
  };
}

const mockService = {
  requestDocument: jest.fn(),
  getMyRequests: jest.fn(),
  getRequest: jest.fn(),
  getAllPending: jest.fn(),
  approveRequest: jest.fn(),
  rejectRequest: jest.fn(),
  revokeDocument: jest.fn(),
  verifyDocument: jest.fn(),
  generatePdf: jest.fn(),
};

const mockEvents = { emitDocumentStatusChanged: jest.fn() };

function makeAuthReq(usn = '1RV21CS001') {
  return { user: { sapId: usn } };
}

function makeAuthReqNoUsn(id = 'user-id-1') {
  return { user: { id } };
}

function makeAuthReqEmpty() {
  return { user: {} };
}

describe('DocumentsController', () => {
  let controller: DocumentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: mockService },
        { provide: EventsGateway, useValue: mockEvents },
      ],
    }).compile();
    controller = module.get<DocumentsController>(DocumentsController);
  });

  describe('requestDocument', () => {
    it('delegates to service with usn from request', async () => {
      mockService.requestDocument.mockResolvedValueOnce(makeDoc());
      const dto = { docType: 'BONAFIDE' as DocType, purpose: 'Bank loan', studentName: 'Arjun Sharma', consentGiven: true };
      const result = await controller.requestDocument(makeAuthReq() as never, dto);
      expect(result.id).toBe('doc-uuid-1');
      expect(mockService.requestDocument).toHaveBeenCalledWith('1RV21CS001', dto);
    });
  });

  describe('getMyRequests', () => {
    it('returns list from service', async () => {
      mockService.getMyRequests.mockResolvedValueOnce([makeDoc()]);
      const result = await controller.getMyRequests(makeAuthReq() as never);
      expect(result).toHaveLength(1);
    });

    it('uses usn from token (IDOR: no id param in URL)', async () => {
      mockService.getMyRequests.mockResolvedValueOnce([]);
      await controller.getMyRequests(makeAuthReq('DIFFERENT') as never);
      expect(mockService.getMyRequests).toHaveBeenCalledWith('DIFFERENT');
    });
  });

  describe('getRequest', () => {
    it('delegates with id + usn', async () => {
      mockService.getRequest.mockResolvedValueOnce(makeDoc());
      await controller.getRequest('doc-uuid-1', makeAuthReq() as never);
      expect(mockService.getRequest).toHaveBeenCalledWith('doc-uuid-1', '1RV21CS001');
    });

    it('propagates NotFoundException from service', async () => {
      mockService.getRequest.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.getRequest('bad-id', makeAuthReq() as never)).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyDocument', () => {
    it('returns verification data', async () => {
      mockService.verifyDocument.mockResolvedValueOnce({ valid: true, docType: 'Bonafide Certificate' });
      const result = await controller.verifyDocument('doc-uuid-1');
      expect(result).toMatchObject({ valid: true });
    });
  });

  describe('id fallback chain (sapId → sub → id)', () => {
    it('requestDocument uses id when sapId is missing', async () => {
      mockService.requestDocument.mockResolvedValueOnce(makeDoc());
      const dto = { docType: 'BONAFIDE' as DocType, purpose: 'Bank loan', studentName: 'Arjun', consentGiven: true };
      await controller.requestDocument(makeAuthReqNoUsn('user-id-1') as never, dto);
      expect(mockService.requestDocument).toHaveBeenCalledWith('user-id-1', dto);
    });

    it('getMyRequests uses id when sapId is missing', async () => {
      mockService.getMyRequests.mockResolvedValueOnce([]);
      await controller.getMyRequests(makeAuthReqNoUsn('user-id-1') as never);
      expect(mockService.getMyRequests).toHaveBeenCalledWith('user-id-1');
    });

    it('getRequest uses id when sapId is missing', async () => {
      mockService.getRequest.mockResolvedValueOnce(makeDoc());
      await controller.getRequest('doc-uuid-1', makeAuthReqNoUsn('user-id-1') as never);
      expect(mockService.getRequest).toHaveBeenCalledWith('doc-uuid-1', 'user-id-1');
    });

    it('approveRequest uses id when sapId is missing', async () => {
      mockService.approveRequest.mockResolvedValueOnce(makeDoc({ status: 'APPROVED' }));
      await controller.approveRequest('doc-uuid-1', makeAuthReqNoUsn('user-id-1') as never);
      expect(mockService.approveRequest).toHaveBeenCalledWith('doc-uuid-1', 'user-id-1');
    });

    it('rejectRequest uses id when sapId is missing', async () => {
      mockService.rejectRequest.mockResolvedValueOnce(makeDoc({ status: 'REJECTED' }));
      await controller.rejectRequest('doc-uuid-1', 'reason', makeAuthReqNoUsn('user-id-1') as never);
      expect(mockService.rejectRequest).toHaveBeenCalledWith('doc-uuid-1', 'user-id-1', 'reason');
    });

    it('revokeDocument uses id when sapId is missing', async () => {
      mockService.revokeDocument.mockResolvedValueOnce(makeDoc({ status: 'REVOKED' }));
      await controller.revokeDocument('doc-uuid-1', makeAuthReqNoUsn('user-id-1') as never);
      expect(mockService.revokeDocument).toHaveBeenCalledWith('doc-uuid-1', 'user-id-1');
    });
  });

  describe('missing identity throws UnauthorizedException', () => {
    it('requestDocument throws when no user identifier', () => {
      const dto = { docType: 'BONAFIDE' as DocType, purpose: 'Bank loan', studentName: 'Arjun', consentGiven: true };
      expect(() => controller.requestDocument(makeAuthReqEmpty() as never, dto)).toThrow(UnauthorizedException);
    });

    it('getMyRequests throws when no user identifier', () => {
      expect(() => controller.getMyRequests(makeAuthReqEmpty() as never)).toThrow(UnauthorizedException);
    });

    it('getRequest throws when no user identifier', () => {
      expect(() => controller.getRequest('doc-uuid-1', makeAuthReqEmpty() as never)).toThrow(UnauthorizedException);
    });

    it('approveRequest throws when no admin identifier', () => {
      expect(() => controller.approveRequest('doc-uuid-1', makeAuthReqEmpty() as never)).toThrow(UnauthorizedException);
    });

    it('rejectRequest throws when no admin identifier', () => {
      expect(() => controller.rejectRequest('doc-uuid-1', 'reason', makeAuthReqEmpty() as never)).toThrow(UnauthorizedException);
    });

    it('revokeDocument throws when no admin identifier', () => {
      expect(() => controller.revokeDocument('doc-uuid-1', makeAuthReqEmpty() as never)).toThrow(UnauthorizedException);
    });
  });

  describe('downloadDocument', () => {
    it('streams PDF buffer via response', async () => {
      const pdfBuf = Buffer.from('%PDF-fake');
      mockService.generatePdf.mockResolvedValueOnce(pdfBuf);
      const mockRes = { set: jest.fn(), end: jest.fn() };
      await controller.downloadDocument('doc-uuid-1', 'valid-token', mockRes as never);
      expect(mockService.generatePdf).toHaveBeenCalledWith('doc-uuid-1', 'valid-token');
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({ 'Content-Type': 'application/pdf' }),
      );
      expect(mockRes.end).toHaveBeenCalledWith(pdfBuf);
    });

    it('propagates error from service', async () => {
      const { UnauthorizedException } = await import('@nestjs/common');
      mockService.generatePdf.mockRejectedValueOnce(new UnauthorizedException());
      const mockRes = { set: jest.fn(), end: jest.fn() };
      await expect(
        controller.downloadDocument('doc-uuid-1', 'bad-token', mockRes as never),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getAllPending', () => {
    it('returns pending queue', async () => {
      mockService.getAllPending.mockResolvedValueOnce([makeDoc(), makeDoc({ id: 'doc-uuid-2' })]);
      const result = await controller.getAllPending();
      expect(result).toHaveLength(2);
    });
  });

  describe('approveRequest', () => {
    it('delegates with id + admin usn', async () => {
      mockService.approveRequest.mockResolvedValueOnce(makeDoc({ status: 'APPROVED' }));
      const result = await controller.approveRequest('doc-uuid-1', makeAuthReq('admin-usn') as never);
      expect(mockService.approveRequest).toHaveBeenCalledWith('doc-uuid-1', 'admin-usn');
      expect(result.status).toBe('APPROVED');
    });

    it('propagates ConflictException from service', async () => {
      mockService.approveRequest.mockRejectedValueOnce(new ConflictException());
      await expect(controller.approveRequest('doc-uuid-1', makeAuthReq() as never)).rejects.toThrow(ConflictException);
    });
  });

  describe('rejectRequest', () => {
    it('delegates with id + reason + admin usn', async () => {
      mockService.rejectRequest.mockResolvedValueOnce(makeDoc({ status: 'REJECTED' }));
      await controller.rejectRequest('doc-uuid-1', 'Insufficient info', makeAuthReq('admin-usn') as never);
      expect(mockService.rejectRequest).toHaveBeenCalledWith('doc-uuid-1', 'admin-usn', 'Insufficient info');
    });
  });

  describe('revokeDocument', () => {
    it('delegates with id + admin usn', async () => {
      mockService.revokeDocument.mockResolvedValueOnce(makeDoc({ status: 'REVOKED' }));
      await controller.revokeDocument('doc-uuid-1', makeAuthReq('admin-usn') as never);
      expect(mockService.revokeDocument).toHaveBeenCalledWith('doc-uuid-1', 'admin-usn');
    });

    it('propagates NotFoundException from service', async () => {
      mockService.revokeDocument.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.revokeDocument('bad-id', makeAuthReq() as never)).rejects.toThrow(NotFoundException);
    });
  });
});
