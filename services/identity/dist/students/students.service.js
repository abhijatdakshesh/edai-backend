"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentsService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
let StudentsService = class StudentsService {
    constructor() {
        this.students = [
            {
                id: 's-1',
                userId: 'u-s-1',
                sapId: 'SAP001',
                usn: '1RV21CS001',
                name: 'Aarav Sharma',
                dob: '2003-05-12',
                sectionId: 'CS-A',
                institutionId: 'rvce',
                createdAt: new Date().toISOString(),
            },
        ];
        this.links = [
            {
                id: 'l-1',
                parentId: 'p-1',
                studentId: 's-1',
                isPrimary: true,
                linkedAt: new Date().toISOString(),
            },
        ];
    }
    findById(id, requesterId) {
        const student = this.students.find((s) => s.id === id);
        if (!student)
            throw new common_1.NotFoundException('Student not found');
        const isStudent = student.userId === requesterId || student.id === requesterId;
        const isLinkedParent = this.links.some((l) => l.studentId === id && l.parentId === requesterId);
        if (!isStudent && !isLinkedParent) {
            throw new common_1.ForbiddenException('Access denied');
        }
        return student;
    }
    create(data) {
        const student = { ...data, id: (0, node_crypto_1.randomUUID)(), createdAt: new Date().toISOString() };
        this.students.push(student);
        return student;
    }
    addLink(parentId, studentId) {
        const existing = this.links.find((l) => l.parentId === parentId && l.studentId === studentId);
        if (existing)
            return existing;
        const link = {
            id: (0, node_crypto_1.randomUUID)(),
            parentId,
            studentId,
            isPrimary: false,
            linkedAt: new Date().toISOString(),
        };
        this.links.push(link);
        return link;
    }
};
exports.StudentsService = StudentsService;
exports.StudentsService = StudentsService = __decorate([
    (0, common_1.Injectable)()
], StudentsService);
//# sourceMappingURL=students.service.js.map