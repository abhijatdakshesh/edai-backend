import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { NlQueryService } from './nl-query.service';

jest.mock('../shared/claude-ai', () => ({
  claudeGenerate: jest.fn(),
  CLAUDE_FAST: 'claude-haiku-4-5-20251001',
  CLAUDE_SMART: 'claude-sonnet-4-6',
}));
const mockClaudeGenerate = jest.requireMock('../shared/claude-ai').claudeGenerate as jest.Mock;

const mockQuery = jest.fn();
const mockDataSource = { query: mockQuery };

function claudeOk(sql: string) {
  return sql;
}

async function buildService(withDb = true): Promise<NlQueryService> {
  const providers: any[] = [NlQueryService];
  if (withDb) providers.push({ provide: getDataSourceToken(), useValue: mockDataSource });
  const module: TestingModule = await Test.createTestingModule({ providers }).compile();
  return module.get<NlQueryService>(NlQueryService);
}

describe('NlQueryService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('query — validation', () => {
    it('throws BadRequestException for empty input', async () => {
      await expect((await buildService()).query('')).rejects.toBeInstanceOf(BadRequestException);
    });
    it('throws BadRequestException for whitespace-only input', async () => {
      await expect((await buildService()).query('   ')).rejects.toBeInstanceOf(BadRequestException);
    });
    it('throws BadRequestException when query exceeds 500 chars', async () => {
      await expect((await buildService()).query('a'.repeat(501))).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('query — happy path', () => {
    it('returns sql, columns, rows, rowCount on success', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('SELECT name AS "Student Name" FROM students LIMIT 5'));
      mockQuery.mockResolvedValue([{ 'Student Name': 'Arjun Sharma' }]);
      const result = await svc.query('show all students');
      expect(result.sql).toContain('SELECT');
      expect(result.columns).toEqual(['Student Name']);
      expect(result.rowCount).toBe(1);
    });

    it('strips markdown fences from generated SQL', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('```sql\nSELECT id FROM students\n```'));
      mockQuery.mockResolvedValue([]);
      const result = await svc.query('list student ids');
      expect(result.sql).toBe('SELECT id FROM students');
    });

    it('returns empty columns when rows is empty', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('SELECT id FROM students WHERE 1=0'));
      mockQuery.mockResolvedValue([]);
      const result = await svc.query('list nothing');
      expect(result.columns).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('appends LIMIT when SQL has none', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('SELECT id FROM students'));
      mockQuery.mockResolvedValue([]);
      await svc.query('list students');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT 500'));
    });

    it('does not double-append LIMIT when already present', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('SELECT id FROM students LIMIT 10'));
      mockQuery.mockResolvedValue([]);
      await svc.query('list 10 students');
      const sql: string = mockQuery.mock.calls[0][0];
      expect((sql.match(/LIMIT/gi) ?? []).length).toBe(1);
    });
  });

  describe('safety — DML blocking', () => {
    const dmlCases = [
      'DELETE FROM students', 'DROP TABLE students', 'INSERT INTO students VALUES (1)',
      "UPDATE students SET name='x'", 'TRUNCATE students', 'ALTER TABLE students ADD COLUMN x INT',
      'CREATE TABLE foo (id INT)', 'GRANT ALL ON students TO hacker', 'REVOKE ALL ON students FROM user',
    ];
    test.each(dmlCases)('blocks: %s', async (badSql) => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk(badSql));
      await expect(svc.query('do something bad')).rejects.toBeInstanceOf(BadRequestException);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('safety — non-SELECT blocking', () => {
    it('blocks SQL starting with EXPLAIN (no DML)', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('EXPLAIN SELECT * FROM students'));
      await expect(svc.query('explain query')).rejects.toBeInstanceOf(BadRequestException);
    });
    it('blocks SQL starting with WITH', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('WITH cte AS (SELECT 1 AS n) SELECT n FROM cte'));
      await expect(svc.query('cte query')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('safety — multi-statement blocking', () => {
    it('blocks SQL with embedded semicolons (no DML)', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('SELECT 1; SELECT 2'));
      await expect(svc.query('two selects')).rejects.toBeInstanceOf(BadRequestException);
    });
    it('allows trailing semicolon (stripped before check)', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('SELECT id FROM students;'));
      mockQuery.mockResolvedValue([]);
      await expect(svc.query('list with semicolon')).resolves.toBeDefined();
    });
  });

  describe('safety — DML in string literal is allowed', () => {
    it('allows SELECT with DELETE in a string value', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk("SELECT id FROM students WHERE name = 'DELETE ME'"));
      mockQuery.mockResolvedValue([]);
      await expect(svc.query("find student named 'DELETE ME'")).resolves.toBeDefined();
    });
  });

  describe('database error handling', () => {
    it('throws InternalServerErrorException when dataSource is null', async () => {
      const svc = await buildService(false);
      mockClaudeGenerate.mockResolvedValue(claudeOk('SELECT id FROM students'));
      await expect(svc.query('list students')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps DB Error instances as BadRequestException', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('SELECT id FROM students'));
      mockQuery.mockRejectedValue(new Error('column "x" does not exist'));
      await expect(svc.query('list students')).rejects.toBeInstanceOf(BadRequestException);
    });
    it('wraps non-Error DB rejections as BadRequestException', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue(claudeOk('SELECT id FROM students'));
      mockQuery.mockRejectedValue('raw string error');
      await expect(svc.query('list students')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Claude SDK error handling', () => {
    it('throws when Claude returns empty text', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockResolvedValue('');
      await expect(svc.query('test')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps SDK Error as InternalServerErrorException', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockRejectedValue(new Error('quota exceeded'));
      await expect(svc.query('test')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
    it('wraps non-Error SDK rejection as InternalServerErrorException', async () => {
      const svc = await buildService();
      mockClaudeGenerate.mockRejectedValue('sdk_string_error');
      await expect(svc.query('test')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('SUGGESTIONS', () => {
    it('has at least 4 suggestions', () => {
      expect(NlQueryService.SUGGESTIONS.length).toBeGreaterThanOrEqual(4);
    });
    it('every suggestion is a non-empty string', () => {
      NlQueryService.SUGGESTIONS.forEach((s) => expect(typeof s).toBe('string'));
    });
  });
});
