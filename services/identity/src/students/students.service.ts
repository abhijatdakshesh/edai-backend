import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { StudentEntity, ParentStudentLinkEntity } from '../entities/student-orm.entity';
import type { Student, ParentStudentLink } from '../entities/student.entity';
import { detectLanguageFromState } from './language-detector';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  // In-memory fallback used when DATABASE_URL is absent (local dev / tests without DB)
  private readonly _students: Student[] = [
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
  private readonly _links: ParentStudentLink[] = [
    { id: 'l-1', parentId: 'p-1', studentId: 's-1', isPrimary: true, linkedAt: new Date().toISOString() },
  ];

  constructor(
    @Optional() @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity> | null,
    @Optional() @InjectRepository(ParentStudentLinkEntity)
    private readonly linkRepo: Repository<ParentStudentLinkEntity> | null,
  ) {}

  private get useDb(): boolean {
    return this.studentRepo != null && this.linkRepo != null;
  }

  async findById(id: string, requesterId: string): Promise<Student> {
    if (this.useDb) {
      const entity = await this.studentRepo!.findOne({ where: { id } });
      if (!entity) throw new NotFoundException('Student not found');
      const isStudent = entity.userId === requesterId || entity.id === requesterId;
      const linkCount = await this.linkRepo!.count({ where: { studentId: id, parentId: requesterId } });
      if (!isStudent && linkCount === 0) throw new ForbiddenException('Access denied');
      return this.toStudentDto(entity);
    }
    const student = this._students.find((s) => s.id === id);
    if (!student) throw new NotFoundException('Student not found');
    const isStudent = student.userId === requesterId || student.id === requesterId;
    const isLinkedParent = this._links.some((l) => l.studentId === id && l.parentId === requesterId);
    if (!isStudent && !isLinkedParent) throw new ForbiddenException('Access denied');
    return student;
  }

  async create(data: Omit<Student, 'id' | 'createdAt'>): Promise<Student> {
    const lang = detectLanguageFromState(data.homeState ?? 'karnataka');
    if (this.useDb) {
      const entity = this.studentRepo!.create({
        userId: data.userId,
        sapId: data.sapId ?? null,
        usn: data.usn,
        name: data.name,
        dob: data.dob ?? null,
        sectionId: data.sectionId ?? null,
        institutionId: data.institutionId,
        homeState: data.homeState ?? null,
        parentPhone: data.parentPhone ?? null,
        parentName: data.parentName ?? null,
        consentVoice: data.consentVoice ?? false,
        parentPreferredLanguage: data.parentPreferredLanguage ?? lang,
      });
      const saved = await this.studentRepo!.save(entity);
      this.logger.log(`Student created: usn=${saved.usn} institution=${saved.institutionId}`);
      return this.toStudentDto(saved);
    }
    const student: Student = {
      ...data,
      id: randomUUID(),
      parentPreferredLanguage: data.parentPreferredLanguage ?? lang,
      createdAt: new Date().toISOString(),
    };
    this._students.push(student);
    return student;
  }

  async findContactByUsn(usn: string): Promise<{
    parentPhone: string;
    parentName: string;
    preferredLanguage: string;
    consentVoice: boolean;
  }> {
    if (this.useDb) {
      const entity = await this.studentRepo!.findOne({ where: { usn } });
      if (!entity) throw new NotFoundException('Student not found');
      return {
        parentPhone: entity.parentPhone ?? '+919876543210',
        parentName: entity.parentName ?? 'Parent',
        preferredLanguage: entity.parentPreferredLanguage ?? 'kn',
        consentVoice: entity.consentVoice,
      };
    }
    const student = this._students.find((s) => s.usn === usn);
    if (!student) throw new NotFoundException('Student not found');
    return {
      parentPhone: student.parentPhone ?? '+919876543210',
      parentName: student.parentName ?? 'Parent',
      preferredLanguage: student.parentPreferredLanguage ?? 'kn',
      consentVoice: student.consentVoice ?? false,
    };
  }

  async addLink(parentId: string, studentId: string): Promise<ParentStudentLink> {
    if (this.useDb) {
      const existing = await this.linkRepo!.findOne({ where: { parentId, studentId } });
      if (existing) return this.toLinkDto(existing);
      const link = this.linkRepo!.create({ parentId, studentId, isPrimary: false });
      const saved = await this.linkRepo!.save(link);
      return this.toLinkDto(saved);
    }
    const existing = this._links.find((l) => l.parentId === parentId && l.studentId === studentId);
    if (existing) return existing;
    const link: ParentStudentLink = {
      id: randomUUID(), parentId, studentId, isPrimary: false, linkedAt: new Date().toISOString(),
    };
    this._links.push(link);
    return link;
  }

  private toStudentDto(e: StudentEntity): Student {
    return {
      id: e.id,
      userId: e.userId,
      sapId: e.sapId ?? undefined,
      usn: e.usn,
      name: e.name,
      dob: e.dob ?? undefined,
      sectionId: e.sectionId ?? undefined,
      photoUrl: e.photoUrl ?? undefined,
      biometricRef: e.biometricRef ?? undefined,
      institutionId: e.institutionId,
      homeState: e.homeState ?? undefined,
      parentPhone: e.parentPhone ?? undefined,
      parentName: e.parentName ?? undefined,
      consentVoice: e.consentVoice,
      parentPreferredLanguage: e.parentPreferredLanguage,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
    };
  }

  private toLinkDto(e: ParentStudentLinkEntity): ParentStudentLink {
    return {
      id: e.id,
      parentId: e.parentId,
      studentId: e.studentId,
      isPrimary: e.isPrimary,
      linkedAt: e.linkedAt instanceof Date ? e.linkedAt.toISOString() : String(e.linkedAt),
    };
  }
}
