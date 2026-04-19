import { JobsService } from './jobs.service';
export declare class JobsController {
    private readonly svc;
    constructor(svc: JobsService);
    getJobs(): import("./jobs.service").Job[];
    apply(id: string, req: any): {
        message: string;
    };
    getPredictions(dept: string, likelihood: string): import("./jobs.service").PlacementPrediction[];
}
