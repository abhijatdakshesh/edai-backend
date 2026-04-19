import { IaService } from './ia.service';
import { EventsGateway } from '../events/events.gateway';
export declare class IaController {
    private readonly svc;
    private readonly events;
    constructor(svc: IaService, events: EventsGateway);
    getMarks(subjectCode: string, sem: string): import("./ia.service").IAEntry[];
    saveMarks(body: {
        subjectCode: string;
        sem: number;
        marks: Array<{
            usn: string;
            ia1: number;
            ia2: number;
            ia3: number;
        }>;
    }, req: any): import("./ia.service").IASubmission;
    submitForReview(body: {
        subjectCode: string;
        sem: number;
    }, req: any): import("./ia.service").IASubmission;
    getAllSubmissions(): import("./ia.service").IASubmission[];
    confirm(id: string): import("./ia.service").IASubmission;
    sendReminders(body: {
        teacherIds: string[];
    }): {
        reminded: string[];
    };
    uploadResults(body: {
        subjectCode: string;
        sem: number;
    }): {
        message: string;
    };
}
