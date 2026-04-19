import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Course, CourseType } from '../entities/academics.entity';

export interface CreateCourseDto {
  code: string;
  name: string;
  departmentCode: string;
  semester: number;
  credits: number;
  type: CourseType;
  syllabusUrl?: string;
}

export interface CoursesFilter {
  departmentCode?: string;
  semester?: number;
  type?: CourseType;
  search?: string;
}

@Injectable()
export class CoursesService {
  private readonly store: Course[] = [
    { id: randomUUID(), code: '21CS61', name: 'Machine Learning', departmentCode: 'CSE', semester: 6, credits: 4, type: 'THEORY', active: true, createdAt: new Date().toISOString() },
    { id: randomUUID(), code: '21CSL57', name: 'ML Lab', departmentCode: 'CSE', semester: 5, credits: 1, type: 'LAB', active: true, createdAt: new Date().toISOString() },
    { id: randomUUID(), code: '21CS62', name: 'Computer Networks', departmentCode: 'CSE', semester: 6, credits: 4, type: 'THEORY', active: true, createdAt: new Date().toISOString() },
    { id: randomUUID(), code: '21CS63', name: 'Operating Systems', departmentCode: 'CSE', semester: 6, credits: 4, type: 'THEORY', active: true, createdAt: new Date().toISOString() },
    { id: randomUUID(), code: '21CS641', name: 'Cloud Computing', departmentCode: 'CSE', semester: 6, credits: 3, type: 'ELECTIVE', active: true, createdAt: new Date().toISOString() },
    { id: randomUUID(), code: '21CSL66', name: 'CN & OS Lab', departmentCode: 'CSE', semester: 6, credits: 1, type: 'LAB', active: true, createdAt: new Date().toISOString() },
    { id: randomUUID(), code: '21EC61', name: 'VLSI Design', departmentCode: 'ECE', semester: 6, credits: 4, type: 'THEORY', active: true, createdAt: new Date().toISOString() },
    { id: randomUUID(), code: '21EC62', name: 'Digital Signal Processing', departmentCode: 'ECE', semester: 6, credits: 4, type: 'THEORY', active: true, createdAt: new Date().toISOString() },
    { id: randomUUID(), code: '21ME61', name: 'Heat Transfer', departmentCode: 'ME', semester: 6, credits: 4, type: 'THEORY', active: true, createdAt: new Date().toISOString() },
  ];

  findAll(filters: CoursesFilter): Course[] {
    let results = this.store.filter((c) => c.active);
    if (filters.departmentCode) {
      results = results.filter((c) => c.departmentCode === filters.departmentCode);
    }
    if (filters.semester) {
      results = results.filter((c) => c.semester === filters.semester);
    }
    if (filters.type) {
      results = results.filter((c) => c.type === filters.type);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q),
      );
    }
    return results;
  }

  findById(id: string): Course {
    const course = this.store.find((c) => c.id === id);
    if (!course) throw new NotFoundException(`Course ${id} not found`);
    return course;
  }

  findByCode(code: string): Course {
    const course = this.store.find((c) => c.code === code);
    if (!course) throw new NotFoundException(`Course ${code} not found`);
    return course;
  }

  create(dto: CreateCourseDto): Course {
    const course: Course = {
      id: randomUUID(),
      ...dto,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.store.push(course);
    return course;
  }

  update(id: string, dto: Partial<CreateCourseDto>): Course {
    const idx = this.store.findIndex((c) => c.id === id);
    if (idx === -1) throw new NotFoundException(`Course ${id} not found`);
    this.store[idx] = { ...this.store[idx]!, ...dto };
    return this.store[idx]!;
  }

  deactivate(id: string): Course {
    return this.update(id, { active: false } as Partial<CreateCourseDto>);
  }
}
