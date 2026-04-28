import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ParentPortalController } from './parent-portal.controller';
import { ParentPortalService } from './parent-portal.service';

const mockSvc = {
  getDashboard: jest.fn(),
  getChildren: jest.fn(),
  getChildAttendance: jest.fn(),
  getChildResults: jest.fn(),
  getChildFees: jest.fn(),
  getChild: jest.fn(),
  payFees: jest.fn(),
  verifyFeePayment: jest.fn(),
  checkScholarship: jest.fn(),
  isParentOf: jest.fn(),
};

const makeReq = (sub = 'parent-1') => ({ user: { sub } });
const makeReqId = (id = 'parent-1') => ({ user: { id } });

describe('ParentPortalController', () => {
  let controller: ParentPortalController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSvc.isParentOf.mockReturnValue(true); // default: ownership passes
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParentPortalController],
      providers: [{ provide: ParentPortalService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ParentPortalController>(ParentPortalController);
  });

  it('getDashboard uses sub from request', () => {
    mockSvc.getDashboard.mockReturnValue({});
    controller.getDashboard(makeReq('parent-1'));
    expect(mockSvc.getDashboard).toHaveBeenCalledWith('parent-1');
  });

  it('getDashboard falls back to id when sub absent', () => {
    mockSvc.getDashboard.mockReturnValue({});
    controller.getDashboard(makeReqId('u-parent-01'));
    expect(mockSvc.getDashboard).toHaveBeenCalledWith('u-parent-01');
  });

  it('getDashboard throws UnauthorizedException when both sub and id absent', () => {
    expect(() => controller.getDashboard({ user: {} })).toThrow(UnauthorizedException);
  });

  it('getChildren uses sub from request', () => {
    mockSvc.getChildren.mockReturnValue([]);
    controller.getChildren(makeReq('parent-1'));
    expect(mockSvc.getChildren).toHaveBeenCalledWith('parent-1');
  });

  it('getChildAttendance delegates with usn param when ownership passes', () => {
    mockSvc.getChildAttendance.mockReturnValue({ overall: 80 });
    controller.getChildAttendance('USN001', makeReq());
    expect(mockSvc.getChildAttendance).toHaveBeenCalledWith('USN001');
  });

  it('getChildAttendance throws ForbiddenException when parent does not own student', () => {
    mockSvc.isParentOf.mockReturnValue(false);
    expect(() => controller.getChildAttendance('USN001', makeReq())).toThrow(ForbiddenException);
  });

  it('getChildResults delegates with usn param when ownership passes', () => {
    mockSvc.getChildResults.mockReturnValue({ cgpa: 8.5 });
    controller.getChildResults('USN001', makeReq());
    expect(mockSvc.getChildResults).toHaveBeenCalledWith('USN001');
  });

  it('getChildFees delegates with usn param when ownership passes', () => {
    mockSvc.getChildFees.mockReturnValue({ totalDue: 0 });
    controller.getChildFees('USN001', makeReq());
    expect(mockSvc.getChildFees).toHaveBeenCalledWith('USN001');
  });

  it('getChild delegates with usn when ownership passes', () => {
    mockSvc.getChild.mockReturnValue({ usn: 'USN001' });
    controller.getChild('USN001', makeReq());
    expect(mockSvc.getChild).toHaveBeenCalledWith('USN001');
  });

  it('payFees delegates feeIds (not amount) to service', async () => {
    mockSvc.payFees.mockResolvedValue({ orderId: 'order_123', amount: 50000 });
    await controller.payFees('USN001', { feeIds: ['f-1'] }, makeReq());
    expect(mockSvc.payFees).toHaveBeenCalledWith('USN001', ['f-1']);
  });

  it('verifyFeePayment delegates to service', async () => {
    mockSvc.verifyFeePayment.mockResolvedValue({ success: true });
    await controller.verifyFeePayment('USN001', { orderId: 'ord', paymentId: 'pay', signature: 'sig' }, makeReq());
    expect(mockSvc.verifyFeePayment).toHaveBeenCalledWith('ord', 'pay', 'sig');
  });

  it('checkScholarship delegates with usn when ownership passes', () => {
    mockSvc.checkScholarship.mockReturnValue({ eligible: true, schemes: [] });
    controller.checkScholarship('USN001', makeReq());
    expect(mockSvc.checkScholarship).toHaveBeenCalledWith('USN001');
  });
});
