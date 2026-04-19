export interface Job {
    id: string;
    company: string;
    role: string;
    package: string;
    deadline: string;
    eligibility: string;
    applyUrl: string;
    dept?: string;
}
export interface JobApplication {
    jobId: string;
    usn: string;
    appliedAt: string;
}
export interface PlacementPrediction {
    usn: string;
    name: string;
    likelihood: 'HIGH' | 'MEDIUM' | 'LOW';
    skillGaps: string[];
    dept: string;
}
export declare class JobsService {
    jobs: Job[];
    applications: JobApplication[];
    predictions: PlacementPrediction[];
    getJobs(): Job[];
    apply(jobId: string, usn: string): {
        message: string;
    };
    getPredictions(dept?: string, likelihood?: string): PlacementPrediction[];
}
