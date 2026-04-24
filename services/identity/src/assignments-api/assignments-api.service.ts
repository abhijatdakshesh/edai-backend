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

  getAllAssignments(): Assignment[] {
    return this.assignments;
  }

  getAssignmentsByCourse(courseId: string): Assignment[] {
    return this.assignments.filter((a) => a.subjectCode === courseId);
  }

  getAssignmentById(id: string): Assignment {
    const a = this.assignments.find((a) => a.id === id);
    if (!a) throw new NotFoundException('Assignment not found');
    return a;
  }

  submitAssignment(
    id: string,
    usn: string,
    body: { fileUrl?: string; text?: string },
  ): { submissionId: string; submittedAt: string; status: 'SUBMITTED' } {
    const submissionId = `sub-${id}-${usn}-${Date.now()}`;
    const sub: Submission = {
      id: submissionId,
      assignmentId: id,
      usn,
      studentName: `Student ${usn}`,
      submittedAt: new Date().toISOString(),
      status: 'SUBMITTED',
    };
    this.submissions.push(sub);
    return { submissionId, submittedAt: sub.submittedAt!, status: 'SUBMITTED' };
  }

  gradeSubmissionById(
    subId: string,
    marks: number,
    feedback: string,
  ): { ok: true; submissionId: string; marks: number; feedback: string } {
    const sub = this.submissions.find((s) => s.id === subId);
    if (sub) {
      sub.marks = marks;
      sub.feedback = feedback;
      sub.status = 'GRADED';
    }
    return { ok: true, submissionId: subId, marks, feedback };
  }
}
