export type AssignmentType =
  | 'HOMEWORK'
  | 'PROJECT'
  | 'LAB'
  | 'QUIZ'
  | 'PRESENTATION';

export type SubmissionStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'LATE'
  | 'MISSING'
  | 'GRADED';

export interface Assignment {
  id: string;
  institutionId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string;
  dueDate: Date;
  maxMarks: number;
  weightagePercent: number;
  type: AssignmentType;
  resourceUrls: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt?: Date;
  fileUrls: string[];
  marksObtained?: number;
  feedback?: string;
  status: SubmissionStatus;
  createdAt: Date;
}
