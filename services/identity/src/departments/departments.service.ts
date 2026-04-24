import { Injectable, NotFoundException } from '@nestjs/common';

export interface Department {
  code: string;
  name: string;
  hodUserId: string;
  established: number;
  active: boolean;
  createdAt: string;
}

@Injectable()
export class DepartmentsService {
  private readonly store: Department[] = [
    { code: 'CSE', name: 'Computer Science & Engineering', hodUserId: 'u-hod-01', established: 1983, active: true, createdAt: '2024-01-01T00:00:00.000Z' },
    { code: 'ECE', name: 'Electronics & Communication Engineering', hodUserId: 'u-hod-02', established: 1983, active: true, createdAt: '2024-01-01T00:00:00.000Z' },
    { code: 'ME',  name: 'Mechanical Engineering', hodUserId: 'u-hod-03', established: 1983, active: true, createdAt: '2024-01-01T00:00:00.000Z' },
    { code: 'CV',  name: 'Civil Engineering', hodUserId: 'u-hod-04', established: 1983, active: true, createdAt: '2024-01-01T00:00:00.000Z' },
    { code: 'ISE', name: 'Information Science & Engineering', hodUserId: 'u-hod-05', established: 1997, active: true, createdAt: '2024-01-01T00:00:00.000Z' },
    { code: 'EEE', name: 'Electrical & Electronics Engineering', hodUserId: 'u-hod-06', established: 1983, active: true, createdAt: '2024-01-01T00:00:00.000Z' },
    { code: 'AIML', name: 'AI & Machine Learning', hodUserId: 'u-hod-07', established: 2019, active: true, createdAt: '2024-01-01T00:00:00.000Z' },
    { code: 'MBA', name: 'Master of Business Administration', hodUserId: 'u-hod-08', established: 2001, active: true, createdAt: '2024-01-01T00:00:00.000Z' },
  ];

  findAll(): Department[] {
    return this.store.filter((d) => d.active);
  }

  findByCode(code: string): Department {
    const dept = this.store.find((d) => d.code === code);
    if (!dept) throw new NotFoundException(`Department ${code} not found`);
    return dept;
  }

  create(payload: Omit<Department, 'active' | 'createdAt'>): Department {
    const dept: Department = { ...payload, active: true, createdAt: new Date().toISOString() };
    this.store.push(dept);
    return dept;
  }

  update(code: string, payload: Partial<Department>): Department {
    const idx = this.store.findIndex((d) => d.code === code);
    if (idx === -1) throw new NotFoundException(`Department ${code} not found`);
    this.store[idx] = { ...this.store[idx]!, ...payload };
    return this.store[idx]!;
  }
}
