import { Test, TestingModule } from '@nestjs/testing';
import { NlQueryController } from './nl-query.controller';
import { NlQueryService } from './nl-query.service';

const mockResult = {
  sql: 'SELECT id FROM students LIMIT 500',
  columns: ['id'],
  rows: [{ id: 'abc' }],
  rowCount: 1,
};

const mockSvc = {
  query: jest.fn().mockResolvedValue(mockResult),
};

describe('NlQueryController', () => {
  let controller: NlQueryController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NlQueryController],
      providers: [{ provide: NlQueryService, useValue: mockSvc }],
    }).compile();
    controller = module.get<NlQueryController>(NlQueryController);
  });

  describe('query', () => {
    it('delegates to NlQueryService.query with body.query', async () => {
      const result = await controller.query({ query: 'show all students' });
      expect(mockSvc.query).toHaveBeenCalledWith('show all students');
      expect(result).toEqual(mockResult);
    });

    it('passes through service errors', async () => {
      mockSvc.query.mockRejectedValueOnce(new Error('bad query'));
      await expect(controller.query({ query: 'bad' })).rejects.toThrow('bad query');
    });
  });

  describe('getSuggestions', () => {
    it('returns SUGGESTIONS array from NlQueryService', () => {
      const result = controller.getSuggestions();
      expect(result).toEqual({ suggestions: NlQueryService.SUGGESTIONS });
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });
});
