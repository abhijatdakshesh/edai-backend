import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

const mockStudentsService = {
  findById: jest.fn(),
};

describe('StudentsController', () => {
  let controller: StudentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [{ provide: StudentsService, useValue: mockStudentsService }],
    }).compile();

    controller = module.get<StudentsController>(StudentsController);
  });

  it('findById delegates to service with id and requesterId header', () => {
    const mockStudent = { id: 's-1', name: 'Alice' };
    mockStudentsService.findById.mockReturnValue(mockStudent);

    const result = controller.findById('s-1', 'u-s-1');
    expect(mockStudentsService.findById).toHaveBeenCalledWith('s-1', 'u-s-1');
    expect(result).toBe(mockStudent);
  });

  it('findById uses default requesterId s-1 when header absent', () => {
    const mockStudent = { id: 's-1', name: 'Alice' };
    mockStudentsService.findById.mockReturnValue(mockStudent);

    // Call without second arg — TypeScript default 's-1' kicks in
    (controller.findById as Function).call(controller, 's-1');
    expect(mockStudentsService.findById).toHaveBeenCalledWith('s-1', 's-1');
  });

  it('propagates NotFoundException from service', () => {
    mockStudentsService.findById.mockImplementation(() => { throw new NotFoundException(); });
    expect(() => controller.findById('s-99', 'any')).toThrow(NotFoundException);
  });

  it('propagates ForbiddenException from service', () => {
    mockStudentsService.findById.mockImplementation(() => { throw new ForbiddenException(); });
    expect(() => controller.findById('s-1', 'random')).toThrow(ForbiddenException);
  });
});
