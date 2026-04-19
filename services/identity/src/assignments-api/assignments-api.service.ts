import { Injectable, NotFoundException } from '@nestjs/common';

export interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  subjectCode: string;
  description: string;
  maxMarks: number;
  status: 'DRAFT' | 'PUBLISHED';
  teacherId: string;
  submissionCount?: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  usn: string;
  studentName: string;
  submittedAt?: string;
  marks?: number;
  feedback?: string;
  status: 'PENDING' | 'SUBMITTED' | 'GRADED';
}

@Injectable()
export class AssignmentsApiService {
  assignments: Assignment[] = [];
  submissions: Submission[] = [];

  getStudentAssignments(usn: string): { assignment: Assignment; submission?: Submission }[] {
    return this.assignments
      .filter((a) => a.status === 'PUBLISHED')
      .map((a) => ({
        assignment: a,
        submission: this.submissions.find(
          (s) => s.assignmentId === a.id && s.usn === usn,
        ),
      }));
  }

  getTeacherAssignments(teacherId: string): Assignment[] {
    return this.assignments
      .filter((a) => a.teacherId === teacherId)
      .map((a) => ({
        ...a,
        submissionCount: this.submissions.filter(
          (s) => s.assignmentId === a.id && s.status !== 'PENDING',
        ).length,
      }));
  }

  createAssignment(
    data: {
      title: string;
      dueDate: string;
      subjectCode: string;
      description: string;
      maxMarks: number;
    },
    teacherId: string,
  ): Assignment {
    const assignment: Assignment = {
      id: `asn-${Date.now()}`,
      ...data,
      status: 'DRAFT',
      teacherId,
    };
    this.assignments.push(assignment);
    return assignment;
  }

  publishAssignment(id: string): Assignment {
    const assignment = this.assignments.find((a) => a.id === id);
    if (!assignment) throw new NotFoundException('Assignment not found');
    assignment.status = 'PUBLISHED';
    return assignment;
  }

  getSubmissions(assignmentId: string): Submission[] {
    return this.submissions.filter((s) => s.assignmentId === assignmentId);
  }

  gradeSubmission(
    assignmentId: string,
    usn: string,
    marks: number,
    feedback: string,
  ): Submission {
    const sub = this.submissions.find(
      (s) => s.assignmentId === assignmentId && s.usn === usn,
    );
    if (!sub) throw new NotFoundException('Submission not found');
    sub.marks = marks;
    sub.feedback = feedback;
    sub.status = 'GRADED';
    return sub;
  }
}
