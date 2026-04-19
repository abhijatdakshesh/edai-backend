import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Parent } from '../entities/parent.entity';
import { StudentsService } from '../students/students.service';

interface OtpRecord {
  parentId: string;
  studentId: string;
  otp: string;
  expiresAt: number;
}

@Injectable()
export class ParentsService {
  private readonly parents: Parent[] = [
    {
      id: 'p-1',
      userId: 'u-p-1',
      relation: 'FATHER',
      phoneToken: 'token-abc-123',
      preferredLanguage: 'kn',
      consentFlags: { voice: true, whatsapp: true, sms: true, email: false },
      createdAt: new Date().toISOString(),
    },
  ];

  /** OTP store — replace with Redis in production */
  private readonly otpStore: OtpRecord[] = [];

  constructor(private readonly studentsService: StudentsService) {}

  issueOtp(parentId: string, studentId: string): { otp: string } {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpStore.push({ parentId, studentId, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    // In production: send OTP via comms service
    return { otp };
  }

  linkStudent(parentId: string, studentId: string, otp: string): { linked: boolean } {
    const record = this.otpStore.find(
      (o) => o.parentId === parentId && o.studentId === studentId && o.otp === otp,
    );

    if (!record || record.expiresAt < Date.now()) {
      // Dev fallback: accept the static code for local testing
      if (otp !== '123456') {
        throw new BadRequestException('Invalid or expired OTP');
      }
    }

    this.studentsService.addLink(parentId, studentId);
    this.otpStore.splice(this.otpStore.indexOf(record!), 1);
    return { linked: true };
  }

  findById(id: string): Parent | undefined {
    return this.parents.find((p) => p.id === id);
  }

  create(data: Omit<Parent, 'id' | 'createdAt'>): Parent {
    const parent: Parent = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    this.parents.push(parent);
    return parent;
  }
}
