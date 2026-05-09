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

  getStudyPlan(usn: string): {
    id: string;
    studentUsn: string;
    generatedAt: string;
    streakDays: number;
    totalTasks: number;
    completedTasks: number;
    tasks: Array<{
      id: string; subjectId: string; subjectName: string; topic: string;
      scheduledDate: string; durationMins: number; completed: boolean; completedAt?: string;
    }>;
  } {
    const tasks = this.studyTasks.filter((t) => t.usn === usn);
    return {
      id: `plan-${usn}`,
      studentUsn: usn,
      generatedAt: new Date().toISOString(),
      streakDays: 0,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.done).length,
      tasks: tasks.map((t) => ({
        id: t.id,
        subjectId: t.subject.toLowerCase().replace(/\s+/g, '-'),
        subjectName: t.subject,
        topic: t.title,
        scheduledDate: t.dueDate,
        durationMins: 60,
        completed: t.done,
      })),
    };
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

  assessStress(
    usn: string,
    answers: Record<string, number>,
  ): { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH'; recommendations: string[] } {
    const values = Object.values(answers);
    const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 3;
    const score = Math.round(avg * 20);
    const level: 'LOW' | 'MEDIUM' | 'HIGH' = score < 40 ? 'LOW' : score < 70 ? 'MEDIUM' : 'HIGH';
    const recommendations =
      level === 'LOW'
        ? ['Keep up your healthy habits!']
        : level === 'MEDIUM'
          ? ['Try mindfulness exercises', 'Maintain a study schedule']
          : ['Book a counseling session', 'Practice deep breathing', 'Reach out to a friend'];
    return { score, level, recommendations };
  }

  generateStudyPlan(
    usn: string,
    examDate?: string,
    subjects?: string[],
  ) {
    // Wipe any prior plan for this student so "Generate New Plan" feels fresh
    this.studyTasks = this.studyTasks.filter((t) => t.usn !== usn);

    const subjectList = subjects && subjects.length
      ? subjects
      : ['Database Management Systems', 'Operating Systems', 'Computer Networks', 'Design & Analysis of Algorithms', 'Machine Learning'];

    const now = new Date();
    const target = examDate ? new Date(examDate) : new Date(now.getTime() + 14 * 86_400_000);
    const dayMs = 86_400_000;
    const totalDays = Math.max(7, Math.min(21, Math.ceil((target.getTime() - now.getTime()) / dayMs)));

    const topics: Record<string, string[]> = {
      'Database Management Systems': ['Normalization revision', 'SQL joins practice', 'Transactions & locking'],
      'Operating Systems': ['Process scheduling', 'Page replacement algorithms', 'Deadlock handling'],
      'Computer Networks': ['TCP/IP stack revision', 'Routing protocols', 'Network security basics'],
      'Design & Analysis of Algorithms': ['Dynamic programming patterns', 'Greedy algorithms', 'Graph traversal problems'],
      'Machine Learning': ['Linear regression refresher', 'Decision trees', 'Confusion matrix & metrics'],
    };

    let i = 0;
    for (const subject of subjectList) {
      const subjectTopics = topics[subject] ?? ['General revision', 'Past paper practice', 'Mock test'];
      for (const topic of subjectTopics) {
        const day = i % totalDays;
        const scheduled = new Date(now.getTime() + day * dayMs).toISOString().slice(0, 10);
        this.studyTasks.push({
          id: `task-${usn}-${i}`,
          usn,
          subject,
          title: topic,
          done: false,
          dueDate: scheduled,
        });
        i++;
      }
    }

    return this.getStudyPlan(usn);
  }
}
