import { JobsService } from './jobs.service';
export declare class JobsController {
    private readonly svc;
    constructor(svc: JobsService);
    getJobs(): import("./jobs.service").Job[];
    getMyApplications(req: any): {
        id: string;
        jobId: string;
        companyName: string;
        role: string;
        status: "APPLIED" | "SHORTLISTED" | "REJECTED";
        appliedAt: string;
    }[];
    withdrawApplication(id: string): {
        ok: true;
    };
    getJob(id: string): import("./jobs.service").Job;
    apply(id: string, req: any): {
        message: string;
    };
    getPredictions(dept: string, likelihood: string): import("./jobs.service").PlacementPrediction[];
}
