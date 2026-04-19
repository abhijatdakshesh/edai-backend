import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface MentorMapping {
  id: string;
  mentorId: string;
  studentId: string;
  institutionId: string;
  assignedAt: string;
}

export interface CounsellingSession {
  id: string;
  mentorId: string;
  studentId: string;
  scheduledAt: string;
  status: SessionStatus;
  notes?: string;
  createdAt: string;
}

@Injectable()
export class MentorshipService {
  private readonly logger = new Logger(MentorshipService.name);
  private readonly mappings: MentorMapping[] = [];
  private readonly sessions: CounsellingSession[] = [];

  assignMentor(mentorId: string, studentId: string, institutionId: string): MentorMapping {
    const mapping: MentorMapping = {
      id: randomUUID(),
      mentorId,
      studentId,
      institutionId,
      assignedAt: new Date().toISOString(),
    };
    this.mappings.push(mapping);
    this.logger.log(`Mentor assigned: mentor=${mentorId} student=${studentId}`);
    return mapping;
  }

  scheduleSession(mentorId: string, studentId: string, scheduledAt: string): CounsellingSession {
    const session: CounsellingSession = {
      id: randomUUID(),
      mentorId,
      studentId,
      scheduledAt,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
    };
    this.sessions.push(session);
    return session;
  }

  completeSession(sessionId: string, notes: string): CounsellingSession {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new NotFoundException('Session not found');
    session.status = 'COMPLETED';
    session.notes = notes;
    return session;
  }

  sessionsByStudent(studentId: string): CounsellingSession[] {
    return this.sessions.filter((s) => s.studentId === studentId);
  }

  mappingByStudent(studentId: string): MentorMapping | undefined {
    return this.mappings.find((m) => m.studentId === studentId);
  }
}
