import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';

const mockSvc = {
  findAll: jest.fn(),
  findByCode: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

describe('DepartmentsController', () => {
  let controller: DepartmentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [{ provide: DepartmentsService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
  });

  it('findAll delegates to service', () => {
    mockSvc.findAll.mockReturnValue([{ code: 'CS' }]);
    expect(controller.findAll()).toEqual([{ code: 'CS' }]);
  });

  it('findOne delegates code to service', () => {
    mockSvc.findByCode.mockReturnValue({ code: 'CS', name: 'Computer Science' });
    const result = controller.findOne('CS');
    expect(mockSvc.findByCode).toHaveBeenCalledWith('CS');
    expect(result.code).toBe('CS');
  });

  it('findOne throws NotFoundException for unknown code', () => {
    mockSvc.findByCode.mockImplementation(() => { throw new NotFoundException(); });
    expect(() => controller.findOne('UNKNOWN')).toThrow(NotFoundException);
  });

  it('create delegates body to service', () => {
    const body = { code: 'MECH', name: 'Mechanical' } as any;
    mockSvc.create.mockReturnValue({ ...body, active: true });
    const result = controller.create(body);
    expect(mockSvc.create).toHaveBeenCalledWith(body);
    expect(result.active).toBe(true);
  });

  it('update delegates code and partial body', () => {
    mockSvc.update.mockReturnValue({ code: 'CS', name: 'CS Updated', active: true });
    const result = controller.update('CS', { name: 'CS Updated' });
    expect(mockSvc.update).toHaveBeenCalledWith('CS', { name: 'CS Updated' });
    expect(result.name).toBe('CS Updated');
  });

  it('update throws NotFoundException for unknown code', () => {
    mockSvc.update.mockImplementation(() => { throw new NotFoundException(); });
    expect(() => controller.update('UNKNOWN', {})).toThrow(NotFoundException);
  });
});
