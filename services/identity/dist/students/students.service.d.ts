import type { Student, ParentStudentLink } from '../entities/student.entity';
export declare class StudentsService {
    private readonly students;
    private readonly links;
    findById(id: string, requesterId: string): Student;
    create(data: Omit<Student, 'id' | 'createdAt'>): Student;
    addLink(parentId: string, studentId: string): ParentStudentLink;
}
