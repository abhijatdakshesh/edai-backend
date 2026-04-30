import { ReportGeneratorController } from './report-generator.controller';
import { ReportGeneratorService } from './report-generator.service';
import { InternalServerErrorException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Minimal service double — we test controller behaviour, not service logic
// ---------------------------------------------------------------------------
const mockGenerate = jest.fn();
const mockGetHistory = jest.fn();
const mockGetAllHistory = jest.fn();

const mockService = {
  generate: mockGenerate,
  getHistory: mockGetHistory,
  getAllHistory: mockGetAllHistory,
} as unknown as ReportGeneratorService;

// ---------------------------------------------------------------------------
// Minimal Express response double
// ---------------------------------------------------------------------------
function makeRes(headersSent = false) {
  const res = {
    headersSent,
    set: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  res.status.mockReturnValue(res); // res.status(500).json(...)
  return res;
}

// ---------------------------------------------------------------------------
describe('ReportGeneratorController', () => {
  let controller: ReportGeneratorController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReportGeneratorController(mockService);
  });

  // -------------------------------------------------------------------------
  // generate()
  // -------------------------------------------------------------------------
  describe('generate()', () => {
    const req = { user: { id: 'user-1', role: 'ADMIN' } };
    const body = { reportType: 'ATTENDANCE', params: { semester: 5 } };

    it('calls service.generate, sets correct response headers, and sends ZIP buffer', async () => {
      const zipBuf = Buffer.from('zip-content');
      mockGenerate.mockResolvedValueOnce(zipBuf);

      const res = makeRes();
      await controller.generate(req, body, res as any);

      // Service called with correct args
      expect(mockGenerate).toHaveBeenCalledWith('ATTENDANCE', { semester: 5 }, 'user-1');

      // Headers set correctly
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="ATTENDANCE-report.zip"',
        'Content-Length': String(zipBuf.byteLength),
      });

      // Buffer sent
      expect(res.send).toHaveBeenCalledWith(zipBuf);
    });

    it('uses an empty object for params when body.params is undefined (nullish coalescing)', async () => {
      const zipBuf = Buffer.from('z');
      mockGenerate.mockResolvedValueOnce(zipBuf);

      const res = makeRes();
      const bodyNullParams = { reportType: 'MARKS', params: undefined as any };
      await controller.generate(req, bodyNullParams, res as any);

      // params should fall back to {}
      expect(mockGenerate).toHaveBeenCalledWith('MARKS', {}, 'user-1');
      expect(res.send).toHaveBeenCalled();
    });

    it('when service throws → calls res.status(500).json() with error message', async () => {
      mockGenerate.mockRejectedValueOnce(new InternalServerErrorException('Report engine error 502: Bad Gateway'));

      const res = makeRes(false);
      await controller.generate(req, body, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Report engine error'),
      });
      // Buffer must NOT have been sent
      expect(res.send).not.toHaveBeenCalled();
    });

    it('when service throws and headers are already sent → skips res.status(500).json()', async () => {
      mockGenerate.mockRejectedValueOnce(new Error('too late'));

      const res = makeRes(true); // headersSent = true
      await controller.generate(req, body, res as any);

      // Should not attempt to write a second response
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('when error has no .message → falls back to default message string', async () => {
      // Throwing a non-Error object whose .message is undefined
      mockGenerate.mockRejectedValueOnce({ message: undefined });

      const res = makeRes(false);
      await controller.generate(req, body, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Report generation failed' });
    });
  });

  // -------------------------------------------------------------------------
  // getMyHistory()
  // -------------------------------------------------------------------------
  describe('getMyHistory()', () => {
    it('delegates to service.getHistory with req.user.id', async () => {
      const expected = [{ id: 'r1', status: 'DONE' }];
      mockGetHistory.mockResolvedValueOnce(expected);

      const req = { user: { id: 'user-42' } };
      const result = await controller.getMyHistory(req);

      expect(mockGetHistory).toHaveBeenCalledWith('user-42');
      expect(result).toEqual(expected);
    });
  });

  // -------------------------------------------------------------------------
  // getAllHistory()
  // -------------------------------------------------------------------------
  describe('getAllHistory()', () => {
    it('delegates to service.getAllHistory and returns result', async () => {
      const expected = [{ id: 'r1' }, { id: 'r2' }];
      mockGetAllHistory.mockResolvedValueOnce(expected);

      const result = await controller.getAllHistory();

      expect(mockGetAllHistory).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expected);
    });
  });
});
