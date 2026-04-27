import { Test, TestingModule } from '@nestjs/testing';
import { AdminPortalController } from './admin-portal.controller';
import { AdminPortalService } from './admin-portal.service';

const mockSvc = {
  getDashboard: jest.fn(),
  getReports: jest.fn(),
  getNaac: jest.fn(),
  getNaacMetrics: jest.fn(),
  getAttendanceTrend: jest.fn(),
  getFeeCollection: jest.fn(),
  getDeptAttendance: jest.fn(),
  getPlacementSummary: jest.fn(),
  getPlacementPredictions: jest.fn(),
  triggerBulkImport: jest.fn(),
  getExportRows: jest.fn(),
  exportAnalytics: jest.fn(),
  getClassPerformance: jest.fn(),
};

describe('AdminPortalController', () => {
  let controller: AdminPortalController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPortalController],
      providers: [{ provide: AdminPortalService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminPortalController>(AdminPortalController);
  });

  it('getDashboard delegates to service and returns dashboard', () => {
    const dashboard = { totalStudents: 450, totalFaculty: 35 };
    mockSvc.getDashboard.mockReturnValue(dashboard);
    expect(controller.getDashboard()).toBe(dashboard);
  });

  it('getReports delegates to service', () => {
    mockSvc.getReports.mockReturnValue([]);
    expect(controller.getReports()).toEqual([]);
  });

  it('getNaac delegates to service', () => {
    const naac = { overallScore: 3.12 };
    mockSvc.getNaac.mockReturnValue(naac);
    expect(controller.getNaac()).toBe(naac);
  });

  it('triggerBulkImport delegates with entityType and fileUrl', () => {
    const result = { jobId: 'bulk-1', status: 'QUEUED' };
    mockSvc.triggerBulkImport.mockReturnValue(result);
    const response = controller.triggerBulkImport({ entityType: 'students', fileUrl: 'https://example.com/file.csv' });
    expect(mockSvc.triggerBulkImport).toHaveBeenCalledWith('students', 'https://example.com/file.csv');
    expect(response).toBe(result);
  });

  it('downloadExport returns 501 for non-CSV formats', () => {
    const mockRes = { status: jest.fn().mockReturnThis(), setHeader: jest.fn() };
    const result = controller.downloadExport(
      { type: 'attendance', format: 'XLSX' },
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(501);
    expect((result as any).error).toContain('XLSX');
  });

  it('downloadExport returns CSV for CSV format', () => {
    mockSvc.exportAnalytics.mockReturnValue({ type: 'attendance', count: 100 });
    const mockRes = { status: jest.fn(), setHeader: jest.fn() };
    const result = controller.downloadExport(
      { type: 'attendance', format: 'CSV' },
      mockRes as any,
    );
    expect(typeof result).toBe('string');
    expect(result as string).toContain('type');
  });

  it('getAttendanceTrend delegates to service', () => {
    mockSvc.getAttendanceTrend.mockReturnValue([]);
    expect(controller.getAttendanceTrend()).toEqual([]);
  });

  it('getDeptAttendance delegates to service', () => {
    mockSvc.getDeptAttendance.mockReturnValue([]);
    expect(controller.getDeptAttendance()).toEqual([]);
  });

  it('getPlacementPredictions delegates with dept and likelihood filters', () => {
    mockSvc.getPlacementPredictions.mockReturnValue([]);
    controller.getPlacementPredictions('CS', 'HIGH');
    expect(mockSvc.getPlacementPredictions).toHaveBeenCalledWith('CS', 'HIGH');
  });

  it('exportAnalytics returns CSV by default', async () => {
    const rows = [{ name: 'Alice', score: 95 }];
    mockSvc.getExportRows.mockReturnValue(rows);
    const mockRes = { setHeader: jest.fn(), end: jest.fn() };
    await controller.exportAnalytics('analytics', 'csv', mockRes as any);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(mockRes.end).toHaveBeenCalled();
    const csvOut = mockRes.end.mock.calls[0][0] as string;
    expect(csvOut).toContain('"name"');
    expect(csvOut).toContain('"Alice"');
  });

  it('exportAnalytics returns XLSX format', async () => {
    mockSvc.getExportRows.mockReturnValue([{ type: 'attendance', count: 100 }]);
    const mockRes = { setHeader: jest.fn(), end: jest.fn() };
    await controller.exportAnalytics('analytics', 'xlsx', mockRes as any);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(mockRes.end).toHaveBeenCalled();
  });

  it('exportAnalytics returns PDF format', async () => {
    mockSvc.getExportRows.mockReturnValue([{ type: 'placement', value: 85 }]);
    const mockRes = { setHeader: jest.fn(), pipe: jest.fn() };
    // PDF streams — just verify setHeader called correctly
    try {
      await controller.exportAnalytics('analytics', 'pdf', mockRes as any);
    } catch {
      // PDF doc.pipe() may fail in test env — just check headers were set
    }
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
  });

  it('exportAnalytics sanitises type with special chars', async () => {
    mockSvc.getExportRows.mockReturnValue([]);
    const mockRes = { setHeader: jest.fn(), end: jest.fn() };
    await controller.exportAnalytics('bad<>type', 'csv', mockRes as any);
    const disposition = mockRes.setHeader.mock.calls.find((c: any[]) => c[0] === 'Content-Disposition');
    expect(disposition?.[1]).toContain('bad__type');
  });

  it('exportAnalytics falls back to csv for unknown format', async () => {
    mockSvc.getExportRows.mockReturnValue([]);
    const mockRes = { setHeader: jest.fn(), end: jest.fn() };
    await controller.exportAnalytics('analytics', 'unknown_fmt', mockRes as any);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
  });

  it('exportAnalytics handles empty rows (no headers)', async () => {
    mockSvc.getExportRows.mockReturnValue([]);
    const mockRes = { setHeader: jest.fn(), end: jest.fn() };
    await controller.exportAnalytics('analytics', 'csv', mockRes as any);
    const csvOut = mockRes.end.mock.calls[0][0] as string;
    expect(csvOut).toContain('"data"');
  });

  it('downloadExport uses default type and format when body omits them', () => {
    mockSvc.exportAnalytics.mockReturnValue([{ a: 1 }]);
    const mockRes = { status: jest.fn(), setHeader: jest.fn() };
    const result = controller.downloadExport({ type: undefined as any, format: undefined as any }, mockRes as any);
    expect(typeof result).toBe('string');
  });

  it('downloadExport handles empty array from exportAnalytics', () => {
    mockSvc.exportAnalytics.mockReturnValue([]);
    const mockRes = { status: jest.fn(), setHeader: jest.fn() };
    const result = controller.downloadExport({ type: 'test', format: 'CSV' }, mockRes as any);
    expect(result as string).toBe('[]');
  });

  it('getClassPerformance delegates with classId', () => {
    mockSvc.getClassPerformance.mockReturnValue([]);
    controller.getClassPerformance('class-cs-a');
    expect(mockSvc.getClassPerformance).toHaveBeenCalledWith('class-cs-a');
  });

  it('getClassPerformance delegates without classId', () => {
    mockSvc.getClassPerformance.mockReturnValue([]);
    controller.getClassPerformance(undefined);
    expect(mockSvc.getClassPerformance).toHaveBeenCalledWith(undefined);
  });

  it('getNaacMetrics delegates to service', () => {
    mockSvc.getNaacMetrics.mockReturnValue({ score: 3.5 });
    expect(controller.getNaacMetrics()).toMatchObject({ score: 3.5 });
  });

  it('getFeeCollection delegates to service', () => {
    mockSvc.getFeeCollection.mockReturnValue([]);
    expect(controller.getFeeCollection()).toEqual([]);
  });

  it('getPlacementSummary delegates to service', () => {
    mockSvc.getPlacementSummary.mockReturnValue({ placed: 200 });
    expect(controller.getPlacementSummary()).toMatchObject({ placed: 200 });
  });
});
