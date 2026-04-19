export type ChatUserRole = 'STUDENT' | 'PARENT';
export type ChatMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type EscalationStatus = 'PENDING' | 'RESPONDED' | 'CLOSED';

export interface ChatSession {
  id: string;
  userId: string;
  userRole: ChatUserRole;
  studentId: string;
  institutionId: string;
  startedAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  confidenceScore?: number;
  escalatedToTeacher: boolean;
  createdAt: Date;
}

export interface TeacherEscalation {
  id: string;
  sessionId: string;
  studentId: string;
  teacherId: string;
  question: string;
  aiAttemptedAnswer: string;
  aiConfidenceScore: number;
  studentProfileSummary: string;
  suggestedApproach: string;
  relatedClassQueries: Record<string, unknown>[];
  status: EscalationStatus;
  teacherResponse?: string;
  createdAt: Date;
}
