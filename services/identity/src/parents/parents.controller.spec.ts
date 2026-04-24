import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { LinkStudentDto } from '../dto/auth.dto';

const mockParentsService = {
  linkStudent: jest.fn(),
};

describe('ParentsController', () => {
  let controller: ParentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParentsController],
      providers: [{ provide: ParentsService, useValue: mockParentsService }],
    }).compile();

    controller = module.get<ParentsController>(ParentsController);
  });

  it('linkStudent delegates to service and returns { linked: true }', () => {
    mockParentsService.linkStudent.mockReturnValue({ linked: true });

    const dto: LinkStudentDto = { parentId: 'p-1', studentId: 's-1', otp: '123456' };
    const result = controller.linkStudent(dto);

    expect(mockParentsService.linkStudent).toHaveBeenCalledWith('p-1', 's-1', '123456');
    expect(result).toEqual({ linked: true });
  });

  it('propagates BadRequestException from service', () => {
    mockParentsService.linkStudent.mockImplementation(() => {
      throw new BadRequestException('Invalid or expired OTP');
    });

    const dto: LinkStudentDto = { parentId: 'p-1', studentId: 's-1', otp: 'wrong' };
    expect(() => controller.linkStudent(dto)).toThrow(BadRequestException);
  });
});
