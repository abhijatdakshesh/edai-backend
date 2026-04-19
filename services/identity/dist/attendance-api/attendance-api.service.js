"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceApiService = void 0;
const common_1 = require("@nestjs/common");
let AttendanceApiService = class AttendanceApiService {
    constructor() {
        this.records = [];
    }
    getStudentAttendance(usn) {
        const studentRecords = this.records.filter((r) => r.usn === usn);
        if (studentRecords.length === 0) {
            throw new common_1.NotFoundException('Attendance records not found for USN');
        }
        const subjectMap = new Map();
        for (const r of studentRecords) {
            const key = r.subjectCode;
            if (!subjectMap.has(key)) {
                subjectMap.set(key, { name: r.subjectName, held: 0, attended: 0 });
            }
            const entry = subjectMap.get(key);
            entry.held++;
            if (r.status === 'P')
                entry.attended++;
        }
        const subjects = [];
        let totalHeld = 0;
        let totalAttended = 0;
        for (const [code, data] of subjectMap) {
            subjects.push({
                code,
                name: data.name,
                held: data.held,
                attended: data.attended,
                pct: Math.round((data.attended / data.held) * 100),
            });
            totalHeld += data.held;
            totalAttended += data.attended;
        }
        return {
            overall: totalHeld ? Math.round((totalAttended / totalHeld) * 100) : 0,
            subjects,
        };
    }
    markBulk(classId, date, entries, markedBy) {
        const newRecords = [];
        for (const entry of entries) {
            const existing = this.records.find((r) => r.classId === classId && r.date === date && r.usn === entry.usn);
            if (existing) {
                existing.status = entry.status;
                existing.editedBy = markedBy;
                existing.editedAt = new Date().toISOString();
                newRecords.push(existing);
            }
            else {
                const record = {
                    id: `att-${Date.now()}-${entry.usn}`,
                    classId,
                    date,
                    usn: entry.usn,
                    status: entry.status,
                    subjectCode: 'UNKNOWN',
                    subjectName: 'Unknown',
                    markedBy,
                };
                this.records.push(record);
                newRecords.push(record);
            }
        }
        return newRecords;
    }
    getTeacherSummary(teacherId) {
        const classIds = [...new Set(this.records.map((r) => r.classId))];
        return classIds.map((classId) => {
            const classRecords = this.records.filter((r) => r.classId === classId);
            const subjectCode = classRecords[0]?.subjectCode ?? 'N/A';
            const students = [...new Set(classRecords.map((r) => r.usn))];
            const attendedByStudent = students.map((usn) => classRecords.filter((r) => r.usn === usn && r.status === 'P').length /
                Math.max(classRecords.filter((r) => r.usn === usn).length, 1));
            const avg = attendedByStudent.length > 0
                ? Math.round((attendedByStudent.reduce((a, b) => a + b, 0) /
                    attendedByStudent.length) *
                    100)
                : 0;
            return {
                classId,
                className: `Class ${classId}`,
                subjectCode,
                subject: classRecords[0]?.subjectName ?? 'Unknown',
                totalStudents: students.length,
                avgAttendancePct: avg,
            };
        });
    }
    getClassStudents(classId) {
        const usns = [
            ...new Set(this.records.filter((r) => r.classId === classId).map((r) => r.usn)),
        ];
        return usns.map((usn) => ({ usn, name: `Student ${usn}` }));
    }
    getAuditLog() {
        return this.records.filter((r) => r.editedBy);
    }
    correctRecord(id, status, editedBy) {
        const record = this.records.find((r) => r.id === id);
        if (!record)
            throw new common_1.NotFoundException('Attendance record not found');
        record.status = status;
        record.editedBy = editedBy;
        record.editedAt = new Date().toISOString();
        return record;
    }
};
exports.AttendanceApiService = AttendanceApiService;
exports.AttendanceApiService = AttendanceApiService = __decorate([
    (0, common_1.Injectable)()
], AttendanceApiService);
//# sourceMappingURL=attendance-api.service.js.map