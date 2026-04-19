import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Class, ClassEnrollment } from '../entities/academics.entity';

export interface CreateClassDto {
  name: string;
  departmentCode: string;
  semester: number;
  section: string;
  strength: number;
  classTeacherId: string;
  academicYear: string;
}

export interface ClassesFilter {
  departmentCode?: string;
  semester?: number;
  academicYear?: string;
}

export interface EnrolledStudent {
  usn: string;
  name: string;
  attendancePct?: number; // populated from attendance service
}

@Injectable()
export class ClassesService {
  private readonly store: Class[] = [
    {
      id: 'cls-cse6a',
      name: 'CSE 6A',
      departmentCode: 'CSE',
      semester: 6,
      section: 'A',
      strength: 60,
      classTeacherId: 'u-faculty-01',
      academicYear: '2024-25',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'cls-cse6b',
      name: 'CSE 6B',
      departmentCode: 'CSE',
      semester: 6,
      section: 'B',
      strength: 58,
      classTeacherId: 'u-faculty-02',
      academicYear: '2024-25',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'cls-cse5a',
      name: 'CSE 5A',
      departmentCode: 'CSE',
      semester: 5,
      section: 'A',
      strength: 60,
      classTeacherId: 'u-faculty-01',
      academicYear: '2024-25',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'cls-ece4a',
      name: 'ECE 4A',
      departmentCode: 'ECE',
      semester: 4,
      section: 'A',
      strength: 55,
      classTeacherId: 'u-faculty-03',
      academicYear: '2024-25',
      createdAt: new Date().toISOString(),
    },
  ];

  private readonly enrollments: ClassEnrollment[] = [
    { id: randomUUID(), classId: 'cls-cse6a', studentUsn: '1RV21CS001', studentName: 'Priya Sharma', enrolledAt: new Date().toISOString() },
    { id: randomUUID(), classId: 'cls-cse6a', studentUsn: '1RV21CS002', studentName: 'Arjun Reddy', enrolledAt: new Date().toISOString() },
    { id: randomUUID(), classId: 'cls-cse6a', studentUsn: '1RV21CS003', studentName: 'Bhavana Rao', enrolledAt: new Date().toISOString() },
    { id: randomUUID(), classId: 'cls-cse6a', studentUsn: '1RV21CS004', studentName: 'Chetan Kumar', enrolledAt: new Date().toISOString() },
    { id: randomUUID(), classId: 'cls-cse6a', studentUsn: '1RV21CS005', studentName: 'Deepa Nair', enrolledAt: new Date().toISOString() },
    { id: randomUUID(), classId: 'cls-cse6b', studentUsn: '1RV21CS006', studentName: 'Eshan Mehta', enrolledAt: new Date().toISOString() },
    { id: randomUUID(), classId: 'cls-cse6b', studentUsn: '1RV21CS007', studentName: 'Farhan Sheikh', enrolledAt: new Date().toISOString() },
  ];

  findAll(filters: ClassesFilter): Class[] {
    let results = [...this.store];
    if (filters.departmentCode) {
      results = results.filter((c) => c.departmentCode === filters.departmentCode);
    }
    if (filters.semester) {
      results = results.filter((c) => c.semester === filters.semester);
    }
    if (filters.academicYear) {
      results = results.filter((c) => c.academicYear === filters.academicYear);
    }
    return results;
  }

  findById(id: string): Class {
    const cls = this.store.find((c) => c.id === id);
    if (!cls) throw new NotFoundException(`Class ${id} not found`);
    return cls;
  }

  create(dto: CreateClassDto): Class {
    const cls: Class = {
      id: randomUUID(),
      ...dto,
      createdAt: new Date().toISOString(),
    };
    this.store.push(cls);
    return cls;
  }

  update(id: string, dto: Partial<CreateClassDto>): Class {
    const idx = this.store.findIndex((c) => c.id === id);
    if (idx === -1) throw new NotFoundException(`Class ${id} not found`);
    this.store[idx] = { ...this.store[idx]!, ...dto };
    return this.store[idx]!;
  }

  getStudents(classId: string): EnrolledStudent[] {
    this.findById(classId); // throws if not found
    return this.enrollments
      .filter((e) => e.classId === classId)
      .map((e) => ({
        usn: e.studentUsn,
        name: e.studentName,
        // Phase 2: fetch attendancePct from attendance service
        attendancePct: Math.floor(65 + Math.random() * 30),
      }));
  }

  /** Used by teacher portal — find classes assigned to a faculty */
  findByFaculty(facultyId: string): Class[] {
    return this.store.filter((c) => c.classTeacherId === facultyId);
  }
}
