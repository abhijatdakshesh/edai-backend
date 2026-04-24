import { Test, TestingModule } from '@nestjs/testing';
import { FeesApiController } from './fees-api.controller';
import { FeesApiService } from './fees-api.service';

const mockSvc = {
  getStudentFees: jest.fn(),
  initiatePayment: jest.fn(),
};

describe('FeesApiController', () => {
  let controller: FeesApiController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeesApiController],
      providers: [{ provide: FeesApiService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FeesApiController>(FeesApiController);
  });

  it('getStudentFees delegates to service with usn param', () => {
    const summary = { totalDue: 100000, totalOutstanding: 50000, items: [] };
    mockSvc.getStudentFees.mockReturnValue(summary);
    const result = controller.getStudentFees('USN001');
    expect(mockSvc.getStudentFees).toHaveBeenCalledWith('USN001');
    expect(result).toBe(summary);
  });

  it('initiatePayment delegates to service with body fields', () => {
    const payment = { paymentUrl: 'https://razorpay.com/pay/stub_123', orderId: 'order_123' };
    mockSvc.initiatePayment.mockReturnValue(payment);

    const body = { usn: 'USN001', amount: 50000, feeIds: ['fee-1', 'fee-2'] };
    const result = controller.initiatePayment(body);
    expect(mockSvc.initiatePayment).toHaveBeenCalledWith('USN001', 50000, ['fee-1', 'fee-2']);
    expect(result).toBe(payment);
  });
});
