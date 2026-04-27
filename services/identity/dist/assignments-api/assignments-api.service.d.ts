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
export declare class AssignmentsApiService {
    assignments: Assignment[];
    submissions: Submission[];
    getStudentAssignments(usn: string): {
        assignment: Assignment;
        submission?: Submission;
    }[];
    getTeacherAssignments(teacherId: string): Assignment[];
    createAssignment(data: {
        title: string;
        dueDate: string;
        subjectCode: string;
        description: string;
        maxMarks: number;
    }, teacherId: string): Assignment;
    publishAssignment(id: string): Assignment;
    getSubmissions(assignmentId: string): Submission[];
    gradeSubmission(assignmentId: string, usn: string, marks: number, feedback: string): Submission;
    getAllAssignments(): Assignment[];
    getAssignmentsByCourse(courseId: string): Assignment[];
    getAssignmentById(id: string): Assignment;
    submitAssignment(id: string, usn: string, body: {
        fileUrl?: string;
        text?: string;
    }): {
        submissionId: string;
        submittedAt: string;
        status: 'SUBMITTED';
    };
    gradeSubmissionById(subId: string, marks: number, feedback: string): {
        ok: true;
        submissionId: string;
        marks: number;
        feedback: string;
    };
}
