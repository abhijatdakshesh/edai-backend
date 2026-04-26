import { AssignmentsApiService } from './assignments-api.service';
import { EventsGateway } from '../events/events.gateway';
export declare class AssignmentsApiController {
    private readonly svc;
    private readonly events;
    constructor(svc: AssignmentsApiService, events: EventsGateway);
    getStudentAssignments(req: any): {
        assignment: import("./assignments-api.service").Assignment;
        submission?: import("./assignments-api.service").Submission;
    }[];
    getTeacherAssignments(req: any): import("./assignments-api.service").Assignment[];
    createAssignment(body: {
        title: string;
        dueDate: string;
        subjectCode: string;
        description: string;
        maxMarks: number;
    }, req: any): import("./assignments-api.service").Assignment;
    publishAssignment(id: string): import("./assignments-api.service").Assignment;
    getSubmissions(id: string): import("./assignments-api.service").Submission[];
    gradeSubmission(id: string, usn: string, body: {
        marks: number;
        feedback: string;
    }): import("./assignments-api.service").Submission;
    getAllAssignments(): import("./assignments-api.service").Assignment[];
    getAssignmentsByCourse(courseId: string): import("./assignments-api.service").Assignment[];
    getStudentAssignmentsByUsn(usn: string): {
        assignment: import("./assignments-api.service").Assignment;
        submission?: import("./assignments-api.service").Submission;
    }[];
    getAssignmentDetail(id: string): import("./assignments-api.service").Assignment;
    getSubmissionsById(id: string): import("./assignments-api.service").Submission[];
    submitAssignment(id: string, body: {
        fileUrl?: string;
        text?: string;
    }, req: any): {
        submissionId: string;
        submittedAt: string;
        status: "SUBMITTED";
    };
    gradeSubmissionById(subId: string, body: {
        marks: number;
        feedback: string;
    }): {
        ok: true;
        submissionId: string;
        marks: number;
        feedback: string;
    };
}
