import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Department } from '../entities/academics.entity';

export interface CreateDepartmentDto {
  code: string;
  name: string;
  hodUserId: string;
  established: number;
}

export interface UpdateDepartmentDto {
  name?: string;
  hodUserId?: string;
  active?: boolean;
}

@Injectable()
export class DepartmentsService {
  private readonly store: Department[] = [
    {
      code: 'CSE',
      name: 'Computer Science & Engineering',
      hodUserId: 'u-hod-01',
      established: 1963,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      code: 'ECE',
      name: 'Electronics & Communication Engineering',
      hodUserId: 'u-hod-02',
      established: 1965,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      code: 'ME',
      name: 'Mechanical Engineering',
      hodUserId: 'u-hod-03',
      established: 1963,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      code: 'CV',
      name: 'Civil Engineering',
      hodUserId: 'u-hod-04',
      established: 1963,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      code: 'EEE',
      name: 'Electrical & Electronics Engineering',
      hodUserId: 'u-hod-05',
      established: 1970,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      code: 'ISE',
      name: 'Information Science & Engineering',
      hodUserId: 'u-hod-06',
      established: 1995,
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];

  findAll(): Department[] {
    return this.store.filter((d) => d.active);
  }

  findByCode(code: string): Department {
    const dept = this.store.find((d) => d.code === code);
    if (!dept) throw new NotFoundException(`Department ${code} not found`);
    return dept;
  }

  create(dto: CreateDepartmentDto): Department {
    const dept: Department = {
      code: dto.code,
      name: dto.name,
      hodUserId: dto.hodUserId,
      established: dto.established,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.store.push(dept);
    return dept;
  }

  update(code: string, dto: UpdateDepartmentDto): Department {
    const idx = this.store.findIndex((d) => d.code === code);
    if (idx === -1) throw new NotFoundException(`Department ${code} not found`);
    this.store[idx] = { ...this.store[idx]!, ...dto };
    return this.store[idx]!;
  }
}
