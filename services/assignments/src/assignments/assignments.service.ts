import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Assignment, AssignmentSubmission } from '../entities/assignment.entity';
import {
  CreateAssignmentDto,
  SubmitAssignmentDto,
  GradeSubmissionDto,
} from '../dto/assignments.dto';

/**
 * In-memory store — replace with TypeORM in production.
 * Kafka emissions are stubbed with // KAFKA: comments.
 */
@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);
  private assignments: Assignment[] = [];
  private submissions: AssignmentSubmission[] = [];

  create(dto: CreateAssignmentDto): Assignment {
    const assignment: Assignment = {
      id: randomUUID(),
      ...dto,
      dueDate: new Date(dto.dueDate),
      resourceUrls: dto.resourceUrls ?? [],
      isActive: true,
      createdAt: new Date(),
    };
    this.assignments.push(assignment);
    this.scheduleDeadlineJobs(assignment);
    return assignment;
  }

  listByClass(classId: string): Assignment[] {
    return this.assignments.filter((a) => a.classId === classId && a.isActive);
  }

  listByStudent(studentId: string): Array<Assignment & { submission?: AssignmentSubmission }> {
    return this.assignments
      .filter((a) => a.isActive)
      .map((a) => ({
        ...a,
        submission: this.submissions.find(
          (s) => s.assignmentId === a.id && s.studentId === studentId,
        ),
      }));
  }

  submit(assignmentId: string, dto: SubmitAssignmentDto): AssignmentSubmission {
    const assignment = this.assignments.find((a) => a.id === assignmentId);
    const isLate = assignment ? new Date() > assignment.dueDate : false;
    const sub: AssignmentSubmission = {
      id: randomUUID(),
      assignmentId,
      studentId: dto.studentId,
      submittedAt: new Date(),
      fileUrls: dto.fileUrls,
      status: isLate ? 'LATE' : 'SUBMITTED',
      createdAt: new Date(),
    };
    this.submissions.push(sub);
    return sub;
  }

  grade(submissionId: string, dto: GradeSubmissionDto): AssignmentSubmission | null {
    const sub = this.submissions.find((s) => s.id === submissionId);
    if (!sub) return null;
    sub.marksObtained = dto.marksObtained;
    sub.feedback = dto.feedback;
    sub.status = 'GRADED';

    this.checkPerformanceDrop(sub);
    return sub;
  }

  getSummary(assignmentId: string): Record<string, unknown> {
    const assignment = this.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return { error: 'not found' };
    const subs = this.submissions.filter((s) => s.assignmentId === assignmentId);
    const submitted = subs.filter((s) => s.status !== 'PENDING' && s.status !== 'MISSING').length;
    const missing = subs.filter((s) => s.status === 'MISSING').length;
    const graded = subs.filter((s) => s.status === 'GRADED');
    const avgMarks =
      graded.length > 0
        ? graded.reduce((sum, s) => sum + (s.marksObtained ?? 0), 0) / graded.length
        : null;
    return {
      assignmentId,
      title: assignment.title,
      submitted,
      missing,
      avgMarks,
    };
  }

  /**
   * Called by Bull deadline job at assignment.dueDate.
   * Marks all students who have not submitted as MISSING.
   */
  async processMissedDeadline(assignmentId: string): Promise<void> {
    const assignment = this.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;

    const missedStudents = this.submissions.filter(
      (s) => s.assignmentId === assignmentId && s.status === 'PENDING',
    );

    for (const sub of missedStudents) {
      sub.status = 'MISSING';
      const missCount = this.submissions.filter(
        (s) => s.studentId === sub.studentId && s.status === 'MISSING',
      ).length;

      // KAFKA: emit assignments.missed
      this.logger.debug(
        'KAFKA emit assignments.missed: student=%s assignment=%s missCount=%d',
        sub.studentId,
        assignmentId,
        missCount,
      );
    }
  }

  private scheduleDeadlineJobs(assignment: Assignment): void {
    // Production: add Bull queue jobs:
    // - 48h before: emit assignment.deadline.approaching
    // - at dueDate: call processMissedDeadline
    // - 24h after: emit assignment.missed.followup for still-missing
    this.logger.debug('Deadline jobs scheduled for assignment %s due %s', assignment.id, assignment.dueDate);
  }

  private checkPerformanceDrop(sub: AssignmentSubmission): void {
    const studentGrades = this.submissions
      .filter((s) => s.studentId === sub.studentId && s.status === 'GRADED' && s.marksObtained !== undefined)
      .slice(-6);

    if (studentGrades.length < 3) return;

    const rollingAvg =
      studentGrades.slice(0, -1).reduce((sum, s) => sum + (s.marksObtained ?? 0), 0) /
      (studentGrades.length - 1);

    const currentScore = sub.marksObtained ?? 0;
    const dropPercent = ((rollingAvg - currentScore) / rollingAvg) * 100;

    if (dropPercent > 15) {
      // KAFKA: emit academics.performance.drop
      this.logger.warn(
        'KAFKA emit academics.performance.drop: student=%s drop=%.1f%%',
        sub.studentId,
        dropPercent,
      );
    }
  }
}
