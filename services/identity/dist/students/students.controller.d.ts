import { StudentsService } from './students.service';
import type { Student } from '../entities/student.entity';
export declare class StudentsController {
    private readonly studentsService;
    constructor(studentsService: StudentsService);
    findById(id: string, requesterId?: string): Student;
}
