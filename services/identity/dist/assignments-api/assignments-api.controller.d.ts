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
}
