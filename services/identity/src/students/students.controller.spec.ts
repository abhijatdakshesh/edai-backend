import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

const mockStudentsService = {
  findById: jest.fn(),
  findContactByUsn: jest.fn(),
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

  describe('findById', () => {
    it('delegates to service with id and requesterId header', async () => {
      const mockStudent = { id: 's-1', name: 'Alice' };
      mockStudentsService.findById.mockResolvedValue(mockStudent);

      const result = await controller.findById('s-1', 'u-s-1');
      expect(mockStudentsService.findById).toHaveBeenCalledWith('s-1', 'u-s-1');
      expect(result).toBe(mockStudent);
    });

    it('uses default requesterId s-1 when header absent', async () => {
      const mockStudent = { id: 's-1', name: 'Alice' };
      mockStudentsService.findById.mockResolvedValue(mockStudent);

      await (controller.findById as (id: string, r?: string) => Promise<unknown>).call(controller, 's-1');
      expect(mockStudentsService.findById).toHaveBeenCalledWith('s-1', 's-1');
    });

    it('propagates NotFoundException from service', async () => {
      mockStudentsService.findById.mockRejectedValue(new NotFoundException());
      await expect(controller.findById('s-99', 'any')).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException from service', async () => {
      mockStudentsService.findById.mockRejectedValue(new ForbiddenException());
      await expect(controller.findById('s-1', 'random')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findContactByUsn', () => {
    it('delegates to service and returns contact info', async () => {
      const contact = { parentPhone: '+919876543210', parentName: 'Parent', preferredLanguage: 'kn', consentVoice: false };
      mockStudentsService.findContactByUsn.mockResolvedValue(contact);

      const result = await controller.findContactByUsn('1RV21CS001');
      expect(mockStudentsService.findContactByUsn).toHaveBeenCalledWith('1RV21CS001');
      expect(result).toBe(contact);
    });

    it('propagates NotFoundException for unknown USN', async () => {
      mockStudentsService.findContactByUsn.mockRejectedValue(new NotFoundException());
      await expect(controller.findContactByUsn('UNKNOWN')).rejects.toThrow(NotFoundException);
    });
  });
});
