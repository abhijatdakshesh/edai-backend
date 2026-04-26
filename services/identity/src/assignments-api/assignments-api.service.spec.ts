import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssignmentsApiService, Assignment, Submission } from './assignments-api.service';

describe('AssignmentsApiService', () => {
  let service: AssignmentsApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssignmentsApiService],
    }).compile();

    service = module.get<AssignmentsApiService>(AssignmentsApiService);
  });

  // ─── createAssignment ────────────────────────────────────────────────────────

  describe('createAssignment()', () => {
    it('creates and returns a new DRAFT assignment', () => {
      const data = {
        title: 'Binary Search Tree',
        dueDate: '2026-05-10',
        subjectCode: 'CS301',
        description: 'Implement BST in C++',
        maxMarks: 20,
      };
      const result = service.createAssignment(data, 'teacher-1');

      expect(result.title).toBe('Binary Search Tree');
      expect(result.status).toBe('DRAFT');
      expect(result.teacherId).toBe('teacher-1');
      expect(result.id).toMatch(/^asn-/);
      expect(service.assignments).toHaveLength(1);
    });

    it('stores multiple assignments independently', () => {
      service.createAssignment(
        { title: 'A1', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10 },
        'teacher-1',
      );
      service.createAssignment(
        { title: 'A2', dueDate: '2026-05-02', subjectCode: 'CS102', description: 'd', maxMarks: 20 },
        'teacher-2',
      );
      expect(service.assignments).toHaveLength(2);
    });
  });

  // ─── publishAssignment ───────────────────────────────────────────────────────

  describe('publishAssignment()', () => {
    it('sets status to PUBLISHED for an existing assignment', () => {
      const { id } = service.createAssignment(
        { title: 'A', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10 },
        't1',
      );
      const result = service.publishAssignment(id);
      expect(result.status).toBe('PUBLISHED');
    });

    it('returns the mutated assignment object', () => {
      const { id } = service.createAssignment(
        { title: 'A', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10 },
        't1',
      );
      const result = service.publishAssignment(id);
      expect(result.id).toBe(id);
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => service.publishAssignment('non-existent-id')).toThrow(NotFoundException);
    });
  });

  // ─── getStudentAssignments ───────────────────────────────────────────────────

  describe('getStudentAssignments()', () => {
    it('returns only PUBLISHED assignments', () => {
      // Manually push assignments with unique ids to avoid Date.now() collisions
      const draftAsn = { id: 'asn-draft', title: 'Draft', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10, status: 'DRAFT' as const, teacherId: 't1' };
      const pubAsn = { id: 'asn-pub', title: 'Published', dueDate: '2026-05-02', subjectCode: 'CS102', description: 'd', maxMarks: 10, status: 'DRAFT' as const, teacherId: 't1' };
      service.assignments.push(draftAsn, pubAsn);
      service.publishAssignment('asn-pub');

      const result = service.getStudentAssignments('USN001');
      expect(result).toHaveLength(1);
      expect(result[0].assignment.title).toBe('Published');
    });

    it('attaches a matching submission when one exists', () => {
      const { id } = service.createAssignment(
        { title: 'A', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10 },
        't1',
      );
      service.publishAssignment(id);
      const sub: Submission = {
        id: 'sub-1',
        assignmentId: id,
        usn: 'USN001',
        studentName: 'Alice',
        status: 'SUBMITTED',
      };
      service.submissions.push(sub);

      const result = service.getStudentAssignments('USN001');
      expect(result[0].submission).toBeDefined();
      expect(result[0].submission!.id).toBe('sub-1');
    });

    it('returns undefined submission when no submission exists for that USN', () => {
      const { id } = service.createAssignment(
        { title: 'A', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10 },
        't1',
      );
      service.publishAssignment(id);

      const result = service.getStudentAssignments('USN_NO_SUB');
      expect(result[0].submission).toBeUndefined();
    });

    it('returns empty array when no published assignments exist', () => {
      expect(service.getStudentAssignments('USN001')).toEqual([]);
    });
  });

  // ─── getTeacherAssignments ───────────────────────────────────────────────────

  describe('getTeacherAssignments()', () => {
    it('returns only assignments belonging to the given teacherId', () => {
      service.createAssignment(
        { title: 'A', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10 },
        'teacher-X',
      );
      service.createAssignment(
        { title: 'B', dueDate: '2026-05-02', subjectCode: 'CS102', description: 'd', maxMarks: 10 },
        'teacher-Y',
      );

      const result = service.getTeacherAssignments('teacher-X');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('A');
    });

    it('includes submissionCount excluding PENDING submissions', () => {
      const { id } = service.createAssignment(
        { title: 'A', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10 },
        'teacher-X',
      );
      service.submissions.push(
        { id: 's1', assignmentId: id, usn: 'U1', studentName: 'A', status: 'SUBMITTED' },
        { id: 's2', assignmentId: id, usn: 'U2', studentName: 'B', status: 'PENDING' },
        { id: 's3', assignmentId: id, usn: 'U3', studentName: 'C', status: 'GRADED' },
      );

      const result = service.getTeacherAssignments('teacher-X');
      expect(result[0].submissionCount).toBe(2); // SUBMITTED + GRADED
    });

    it('returns empty array for unknown teacherId', () => {
      expect(service.getTeacherAssignments('unknown-teacher')).toEqual([]);
    });
  });

  // ─── getSubmissions ──────────────────────────────────────────────────────────

  describe('getSubmissions()', () => {
    it('returns submissions for a given assignmentId', () => {
      service.submissions.push(
        { id: 's1', assignmentId: 'asn-1', usn: 'U1', studentName: 'Alice', status: 'SUBMITTED' },
        { id: 's2', assignmentId: 'asn-2', usn: 'U2', studentName: 'Bob', status: 'PENDING' },
      );
      const result = service.getSubmissions('asn-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });

    it('returns empty array when no submissions exist for the assignment', () => {
      expect(service.getSubmissions('asn-nonexistent')).toEqual([]);
    });
  });

  // ─── getAllAssignments ───────────────────────────────────────────────────────

  describe('getAllAssignments()', () => {
    it('returns all assignments regardless of status', () => {
      service.createAssignment(
        { title: 'A', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10 },
        't1',
      );
      service.createAssignment(
        { title: 'B', dueDate: '2026-05-02', subjectCode: 'CS102', description: 'd', maxMarks: 20 },
        't2',
      );
      expect(service.getAllAssignments()).toHaveLength(2);
    });

    it('returns empty array when no assignments exist', () => {
      expect(service.getAllAssignments()).toEqual([]);
    });
  });

  // ─── getAssignmentsByCourse ──────────────────────────────────────────────────

  describe('getAssignmentsByCourse()', () => {
    it('returns assignments matching the given subjectCode', () => {
      service.createAssignment(
        { title: 'A', dueDate: '2026-05-01', subjectCode: 'CS301', description: 'd', maxMarks: 10 },
        't1',
      );
      service.createAssignment(
        { title: 'B', dueDate: '2026-05-02', subjectCode: 'CS302', description: 'd', maxMarks: 20 },
        't2',
      );
      const result = service.getAssignmentsByCourse('CS301');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('A');
    });

    it('returns empty array for unknown course', () => {
      expect(service.getAssignmentsByCourse('UNKNOWN')).toEqual([]);
    });
  });

  // ─── getAssignmentById ───────────────────────────────────────────────────────

  describe('getAssignmentById()', () => {
    it('returns the assignment for a known id', () => {
      const { id } = service.createAssignment(
        { title: 'Test Assignment', dueDate: '2026-05-01', subjectCode: 'CS101', description: 'd', maxMarks: 10 },
        't1',
      );
      const result = service.getAssignmentById(id);
      expect(result.id).toBe(id);
      expect(result.title).toBe('Test Assignment');
    });

    it('throws NotFoundException for unknown id', () => {
      expect(() => service.getAssignmentById('non-existent')).toThrow(NotFoundException);
    });
  });

  // ─── submitAssignment ────────────────────────────────────────────────────────

  describe('submitAssignment()', () => {
    it('creates a submission and returns submissionId + status SUBMITTED', () => {
      const result = service.submitAssignment('asn-1', 'USN001', { text: 'My answer' });
      expect(result.status).toBe('SUBMITTED');
      expect(result.submissionId).toMatch(/^sub-asn-1-USN001-/);
      expect(result.submittedAt).toBeDefined();
    });

    it('adds the submission to the submissions array', () => {
      service.submitAssignment('asn-1', 'USN001', { fileUrl: 'http://example.com/file.pdf' });
      expect(service.submissions).toHaveLength(1);
      expect(service.submissions[0].usn).toBe('USN001');
      expect(service.submissions[0].status).toBe('SUBMITTED');
    });

    it('handles submission without fileUrl or text', () => {
      const result = service.submitAssignment('asn-1', 'USN002', {});
      expect(result.status).toBe('SUBMITTED');
    });
  });

  // ─── gradeSubmissionById ─────────────────────────────────────────────────────

  describe('gradeSubmissionById()', () => {
    it('grades an existing submission by sub id', () => {
      service.submissions.push({
        id: 'sub-x',
        assignmentId: 'asn-1',
        usn: 'USN001',
        studentName: 'Alice',
        status: 'SUBMITTED',
      });
      const result = service.gradeSubmissionById('sub-x', 19, 'Excellent');
      expect(result.ok).toBe(true);
      expect(result.submissionId).toBe('sub-x');
      expect(result.marks).toBe(19);
      expect(result.feedback).toBe('Excellent');
      expect(service.submissions[0].status).toBe('GRADED');
    });

    it('returns ok:true even when submission not found (no-op)', () => {
      const result = service.gradeSubmissionById('non-existent', 10, 'feedback');
      expect(result.ok).toBe(true);
      expect(result.submissionId).toBe('non-existent');
    });
  });

  // ─── gradeSubmission ─────────────────────────────────────────────────────────

  describe('gradeSubmission()', () => {
    it('grades a submission and sets status to GRADED', () => {
      service.submissions.push({
        id: 's1',
        assignmentId: 'asn-1',
        usn: 'U1',
        studentName: 'Alice',
        status: 'SUBMITTED',
      });

      const result = service.gradeSubmission('asn-1', 'U1', 18, 'Good work!');
      expect(result.marks).toBe(18);
      expect(result.feedback).toBe('Good work!');
      expect(result.status).toBe('GRADED');
    });

    it('returns the mutated submission object', () => {
      service.submissions.push({
        id: 's1',
        assignmentId: 'asn-1',
        usn: 'U1',
        studentName: 'Alice',
        status: 'SUBMITTED',
      });
      const result = service.gradeSubmission('asn-1', 'U1', 15, 'Average');
      expect(result.id).toBe('s1');
    });

    it('throws NotFoundException if submission does not exist', () => {
      expect(() =>
        service.gradeSubmission('asn-99', 'UNKNOWN', 10, 'feedback'),
      ).toThrow(NotFoundException);
    });
  });
});
