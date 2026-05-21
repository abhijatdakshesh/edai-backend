import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { UsersService } from '../users/users.service';
import type { CreateUserDto } from '../dto/user.dto';
import type { UserRole, Language } from '../entities/user.entity';

export type BulkImportType = 'students' | 'teachers' | 'parents';

export interface ImportRow {
  // Common fields across all three sheets
  name?: string;
  email?: string;
  password?: string;
  departmentCode?: string;
  preferredLanguage?: string;
  sapId?: string;
  // Type-specific
  usn?: string;             // students
  facultyId?: string;       // teachers
  parentStudentUsn?: string; // parents
}

export interface RowResult {
  rowNumber: number;
  status: 'OK' | 'ERROR';
  message?: string;
  userId?: string;
}

export interface BulkImportSummary {
  type: BulkImportType;
  total: number;
  ok: number;
  failed: number;
  results: RowResult[];
}

interface TemplateSpec {
  headers: string[];
  example: Record<string, string>;
}

const LANGS = ['kn', 'en', 'hi', 'ta', 'te', 'ml'];

const TEMPLATES: Record<BulkImportType, TemplateSpec> = {
  students: {
    headers: ['name', 'email', 'password', 'usn', 'departmentCode', 'preferredLanguage'],
    example: {
      name: 'Arjun Kumar',
      email: 'arjun.kumar@rvce.edu',
      password: 'Student@123',
      usn: '1RV21CS001',
      departmentCode: 'CSE',
      preferredLanguage: 'en',
    },
  },
  teachers: {
    headers: ['name', 'email', 'password', 'facultyId', 'departmentCode', 'preferredLanguage'],
    example: {
      name: 'Dr. Suresh Babu',
      email: 'suresh.babu@rvce.edu',
      password: 'Faculty@123',
      facultyId: 'FAC-CS-014',
      departmentCode: 'CSE',
      preferredLanguage: 'en',
    },
  },
  parents: {
    headers: ['name', 'email', 'password', 'parentStudentUsn', 'preferredLanguage'],
    example: {
      name: 'Mr. Ramesh Kumar',
      email: 'ramesh.kumar@gmail.com',
      password: 'Parent@123',
      parentStudentUsn: '1RV21CS001',
      preferredLanguage: 'en',
    },
  },
};

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(private readonly users: UsersService) {}

  /** Build a single-sheet xlsx workbook with headers + 1 example row. */
  buildTemplate(type: BulkImportType): Buffer {
    const spec = TEMPLATES[type];
    const ws = XLSX.utils.json_to_sheet([spec.example], { header: spec.headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  validate(type: BulkImportType, rows: ImportRow[], institutionId?: string): BulkImportSummary {
    const results = rows.map((row, idx) => this.validateRow(type, row, idx + 1, institutionId));
    return this.summarise(type, results);
  }

  async commit(
    type: BulkImportType,
    rows: ImportRow[],
    institutionId?: string,
  ): Promise<BulkImportSummary> {
    const results: RowResult[] = [];
    const tenant = institutionId ?? 'rvce';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] ?? {};
      const rowNumber = i + 1;

      const validation = this.validateRow(type, row, rowNumber, tenant);
      if (validation.status === 'ERROR') {
        results.push(validation);
        continue;
      }

      const dto = this.rowToCreateDto(type, row, tenant);
      try {
        const created = await this.users.create(dto);
        results.push({
          rowNumber,
          status: 'OK',
          userId: (created as { id?: string }).id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[BulkImport] row ${rowNumber} (${type}) failed: ${msg}`);
        results.push({ rowNumber, status: 'ERROR', message: msg.slice(0, 200) });
      }
    }
    return this.summarise(type, results);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private validateRow(
    type: BulkImportType,
    row: ImportRow,
    rowNumber: number,
    _institutionId?: string,
  ): RowResult {
    if (!row || typeof row !== 'object') {
      return { rowNumber, status: 'ERROR', message: 'Row is empty or malformed' };
    }
    if (!row.name?.trim()) return { rowNumber, status: 'ERROR', message: 'name is required' };
    if (!row.email?.trim()) return { rowNumber, status: 'ERROR', message: 'email is required' };
    if (!/^\S+@\S+\.\S+$/.test(row.email)) {
      return { rowNumber, status: 'ERROR', message: `invalid email: ${row.email}` };
    }
    if (!row.password || row.password.length < 8) {
      return { rowNumber, status: 'ERROR', message: 'password must be at least 8 characters' };
    }
    if (row.preferredLanguage && !LANGS.includes(row.preferredLanguage)) {
      return { rowNumber, status: 'ERROR', message: `preferredLanguage must be one of ${LANGS.join(',')}` };
    }
    if (type === 'students' && !row.usn?.trim()) {
      return { rowNumber, status: 'ERROR', message: 'usn is required for students' };
    }
    if (type === 'parents' && !row.parentStudentUsn?.trim()) {
      return { rowNumber, status: 'ERROR', message: 'parentStudentUsn is required for parents' };
    }
    return { rowNumber, status: 'OK' };
  }

  private rowToCreateDto(
    type: BulkImportType,
    row: ImportRow,
    institutionId: string,
  ): CreateUserDto {
    const role: UserRole =
      type === 'students' ? 'STUDENT' : type === 'teachers' ? 'FACULTY' : 'PARENT';

    return {
      name: (row.name ?? '').trim(),
      email: (row.email ?? '').trim().toLowerCase(),
      password: row.password ?? '',
      role,
      institutionId,
      sapId: row.sapId?.trim() ?? row.usn?.trim() ?? row.facultyId?.trim(),
      departmentCode: row.departmentCode?.trim(),
      preferredLanguage: row.preferredLanguage as Language | undefined,
      parentStudentUsn: type === 'parents' ? row.parentStudentUsn?.trim() : undefined,
    };
  }

  private summarise(type: BulkImportType, results: RowResult[]): BulkImportSummary {
    const ok = results.filter(r => r.status === 'OK').length;
    return { type, total: results.length, ok, failed: results.length - ok, results };
  }
}
