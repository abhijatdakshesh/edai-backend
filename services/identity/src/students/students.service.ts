import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Student, ParentStudentLink } from '../entities/student.entity';
import { detectLanguageFromState } from './language-detector';

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
    const lang = detectLanguageFromState(data.homeState ?? 'karnataka');
    const student: Student = {
      ...data,
      id: randomUUID(),
      parentPreferredLanguage: data.parentPreferredLanguage ?? lang,
      createdAt: new Date().toISOString(),
    };
    this.students.push(student);
    return student;
  }

  findContactByUsn(usn: string): {
    parentPhone: string;
    parentName: string;
    preferredLanguage: string;
    consentVoice: boolean;
  } {
    const student = this.students.find((s) => s.usn === usn);
    if (!student) throw new NotFoundException('Student not found');
    return {
      parentPhone: student.parentPhone ?? '+919876543210',
      parentName: student.parentName ?? 'Parent',
      preferredLanguage: student.parentPreferredLanguage ?? 'kn',
      consentVoice: student.consentVoice ?? false,
    };
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
