import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Student, ParentStudentLink } from '../entities/student.entity';

@Injectable()
export class StudentsService {
  private readonly students: Student[] = [
    {
      id: 's-1',
      userId: 'u-s-1',
      sapId: 'SAP001',
      usn: '1RV21CS001',
      name: 'Aarav Sharma',
      dob: '2003-05-12',
      sectionId: 'CS-A',
      institutionId: 'rvce',
      createdAt: new Date().toISOString(),
    },
  ];

  private readonly links: ParentStudentLink[] = [
    {
      id: 'l-1',
      parentId: 'p-1',
      studentId: 's-1',
      isPrimary: true,
      linkedAt: new Date().toISOString(),
    },
  ];

  findById(id: string, requesterId: string): Student {
    const student = this.students.find((s) => s.id === id);
    if (!student) throw new NotFoundException('Student not found');

    const isStudent = student.userId === requesterId || student.id === requesterId;
    const isLinkedParent = this.links.some((l) => l.studentId === id && l.parentId === requesterId);

    if (!isStudent && !isLinkedParent) {
      throw new ForbiddenException('Access denied');
    }
    return student;
  }

  create(data: Omit<Student, 'id' | 'createdAt'>): Student {
    const student: Student = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    this.students.push(student);
    return student;
  }

  addLink(parentId: string, studentId: string): ParentStudentLink {
    const existing = this.links.find((l) => l.parentId === parentId && l.studentId === studentId);
    if (existing) return existing;
    const link: ParentStudentLink = {
      id: randomUUID(),
      parentId,
      studentId,
      isPrimary: false,
      linkedAt: new Date().toISOString(),
    };
    this.links.push(link);
    return link;
  }
}
