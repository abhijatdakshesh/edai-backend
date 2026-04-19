import { Injectable, NotFoundException } from '@nestjs/common';

export interface CounselorSlot {
  id: string;
  dateTime: string;
  counsellorId: string;
  isBooked: boolean;
}

export interface CounselorSession {
  id: string;
  slotId: string;
  studentUsn: string;
  reason: string;
  status: 'BOOKED' | 'COMPLETED' | 'CANCELLED';
}

export interface StudyTask {
  id: string;
  usn: string;
  subject: string;
  title: string;
  done: boolean;
  dueDate: string;
}

export interface WellnessResource {
  title: string;
  type: string;
  url: string;
}

export interface RiskScore {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: string[];
}

@Injectable()
export class WellnessService {
  slots: CounselorSlot[] = [];
  sessions: CounselorSession[] = [];
  studyTasks: StudyTask[] = [];
  riskScores: Map<string, RiskScore> = new Map();

  readonly resources: WellnessResource[] = [
    { title: 'Stress Management 101', type: 'article', url: 'https://edai.in/resources/stress-101' },
    { title: 'Mindfulness for Students', type: 'video', url: 'https://edai.in/resources/mindfulness' },
    { title: 'Time Management Tips', type: 'guide', url: 'https://edai.in/resources/time-mgmt' },
    { title: 'Study Techniques', type: 'article', url: 'https://edai.in/resources/study-tech' },
  ];

  getSlots(): CounselorSlot[] {
    return this.slots.filter((s) => !s.isBooked);
  }

  getMySessions(usn: string): CounselorSession[] {
    return this.sessions.filter((s) => s.studentUsn === usn);
  }

  bookSession(usn: string, slotId: string, reason: string): CounselorSession {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) throw new NotFoundException('Slot not found');
    slot.isBooked = true;
    const session: CounselorSession = {
      id: `sess-${Date.now()}`,
      slotId,
      studentUsn: usn,
      reason,
      status: 'BOOKED',
    };
    this.sessions.push(session);
    return session;
  }

  getRiskScore(usn: string): RiskScore {
    return (
      this.riskScores.get(usn) ?? {
        score: 30,
        level: 'LOW',
        factors: ['Attendance above 80%', 'Assignments on track'],
      }
    );
  }

  getStudyPlan(usn: string): { tasks: StudyTask[] } {
    return { tasks: this.studyTasks.filter((t) => t.usn === usn) };
  }

  updateTask(taskId: string, done: boolean): StudyTask {
    const task = this.studyTasks.find((t) => t.id === taskId);
    if (!task) throw new NotFoundException('Task not found');
    task.done = done;
    return task;
  }

  getResources(): WellnessResource[] {
    return this.resources;
  }
}
