export type AssessmentComponent =
  | 'HOMEWORK'
  | 'QUIZ'
  | 'IA1'
  | 'IA2'
  | 'PRACTICAL'
  | 'PROJECT'
  | 'SEMESTER';

export type MarksEntryStatus = 'DRAFT' | 'PENDING_REVIEW' | 'VERIFIED' | 'SYNCED';

export type AiValidationFlagType =
  | 'STATISTICAL_OUTLIER'
  | 'HISTORICAL_MISMATCH'
  | 'MISSING_ENTRY'
  | 'INVALID_SCORE'
  | 'UNUSUAL_PATTERN'
  | 'DECIMAL_ERROR';

export interface Subject {
  id: string;
  institutionId: string;
  classId: string;
  name: string;
  code: string;
  teacherId: string;
  assessmentScheme: Record<string, number>;
}

export interface AiValidationFlag {
  studentId: string;
  studentName: string;
  score: number;
  flagType: AiValidationFlagType;
  message: string;
  suggestion?: string;
}

export interface MarksEntry {
  id: string;
  studentId: string;
  subjectId: string;
  institutionId: string;
  component: AssessmentComponent;
  score: number;
  maxScore: number;
  enteredBy: string;
  verifiedBy?: string;
  aiValidationFlags?: AiValidationFlag[];
  status: MarksEntryStatus;
  createdAt: Date;
}

export interface DailyReport {
  id: string;
  teacherId: string;
  institutionId: string;
  reportDate: string;
  contentJson: Record<string, unknown>;
  sentAt?: Date;
  createdAt: Date;
}

export interface CourseEnrollment {
  id: string;
  studentId: string;
  subjectId: string;
  academicYear: string;
  createdAt: Date;
}
