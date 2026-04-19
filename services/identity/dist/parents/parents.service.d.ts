import type { Parent } from '../entities/parent.entity';
import { StudentsService } from '../students/students.service';
export declare class ParentsService {
    private readonly studentsService;
    private readonly parents;
    private readonly otpStore;
    constructor(studentsService: StudentsService);
    issueOtp(parentId: string, studentId: string): {
        otp: string;
    };
    linkStudent(parentId: string, studentId: string, otp: string): {
        linked: boolean;
    };
    findById(id: string): Parent | undefined;
    create(data: Omit<Parent, 'id' | 'createdAt'>): Parent;
}
