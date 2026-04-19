import { AssignmentType } from '../entities/assignment.entity';

export interface CreateAssignmentDto {
  institutionId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string;
  dueDate: string; // ISO date-time
  maxMarks: number;
  weightagePercent: number;
  type: AssignmentType;
  resourceUrls?: string[];
}

export interface SubmitAssignmentDto {
  studentId: string;
  fileUrls: string[];
}

export interface GradeSubmissionDto {
  marksObtained: number;
  feedback?: string;
}
