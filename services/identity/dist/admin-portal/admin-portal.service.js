"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminPortalService = void 0;
const common_1 = require("@nestjs/common");
const fees_api_service_1 = require("../fees-api/fees-api.service");
let AdminPortalService = class AdminPortalService {
    constructor(feesSvc) {
        this.feesSvc = feesSvc;
    }
    getDashboard() {
        const feesCollected = this.feesSvc.feeItems
            .filter((f) => f.status === 'PAID')
            .reduce((sum, f) => sum + f.amount, 0);
        return {
            totalStudents: 450,
            totalFaculty: 35,
            avgAttendance: 82,
            feesCollected,
            alerts: [
                {
                    id: 'alert-1',
                    type: 'ATTENDANCE',
                    message: '12 students below 75% attendance',
                    severity: 'HIGH',
                },
                {
                    id: 'alert-2',
                    type: 'FEES',
                    message: '8 students with overdue fees',
                    severity: 'MEDIUM',
                },
            ],
        };
    }
    getReports() {
        return [
            {
                id: 'rep-1',
                type: 'ATTENDANCE',
                label: 'Monthly Attendance Report',
                data: {
                    month: 'April 2026',
                    avgAttendance: 82,
                    below75: 12,
                    above90: 180,
                },
            },
            {
                id: 'rep-2',
                type: 'ACADEMIC',
                label: 'Semester Performance',
                data: {
                    avgCGPA: 7.4,
                    distinction: 45,
                    fail: 8,
                },
            },
            {
                id: 'rep-3',
                type: 'FEES',
                label: 'Fee Collection Report',
                data: {
                    totalExpected: 4500000,
                    collected: 3800000,
                    outstanding: 700000,
                },
            },
        ];
    }
    getNaac() {
        return {
            overallScore: 3.12,
            criteria: [
                { name: 'Curricular Aspects', score: 3.0, maxScore: 4.0 },
                { name: 'Teaching-Learning and Evaluation', score: 3.2, maxScore: 4.0 },
                { name: 'Research, Innovations and Extension', score: 2.8, maxScore: 4.0 },
                { name: 'Infrastructure and Learning Resources', score: 3.4, maxScore: 4.0 },
                { name: 'Student Support and Progression', score: 3.1, maxScore: 4.0 },
                { name: 'Governance, Leadership and Management', score: 3.0, maxScore: 4.0 },
                { name: 'Institutional Values and Best Practices', score: 3.3, maxScore: 4.0 },
            ],
            strengths: [
                'Strong industry partnerships for placements',
                'Modern infrastructure and labs',
                'Active research culture',
            ],
            improvements: [
                'Increase faculty PhD holders to 60%',
                'Expand international collaborations',
                'Improve student grievance resolution time',
            ],
        };
    }
    triggerBulkImport(entityType, fileUrl) {
        return {
            jobId: `bulk-${Date.now()}`,
            entityType,
            status: 'QUEUED',
            message: `Bulk import for ${entityType} from ${fileUrl} has been queued`,
        };
    }
};
exports.AdminPortalService = AdminPortalService;
exports.AdminPortalService = AdminPortalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [fees_api_service_1.FeesApiService])
], AdminPortalService);
//# sourceMappingURL=admin-portal.service.js.map