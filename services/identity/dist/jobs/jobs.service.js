"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsService = void 0;
const common_1 = require("@nestjs/common");
let JobsService = class JobsService {
    constructor() {
        this.jobs = [];
        this.applications = [];
        this.predictions = [];
    }
    getJobs() {
        return this.jobs;
    }
    apply(jobId, usn) {
        const job = this.jobs.find((j) => j.id === jobId);
        if (!job)
            throw new common_1.NotFoundException('Job not found');
        const existing = this.applications.find((a) => a.jobId === jobId && a.usn === usn);
        if (!existing) {
            this.applications.push({ jobId, usn, appliedAt: new Date().toISOString() });
        }
        return { message: 'Application submitted' };
    }
    getPredictions(dept, likelihood) {
        let results = this.predictions;
        if (dept)
            results = results.filter((p) => p.dept === dept);
        if (likelihood)
            results = results.filter((p) => p.likelihood === likelihood);
        return results;
    }
};
exports.JobsService = JobsService;
exports.JobsService = JobsService = __decorate([
    (0, common_1.Injectable)()
], JobsService);
//# sourceMappingURL=jobs.service.js.map