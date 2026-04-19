export interface ClassRecord {
    id: string;
    name: string;
    subject: string;
    subjectCode: string;
    semester: number;
    instructorId: string;
    instructorName: string;
    studentCount: number;
}
export interface StudentRoster {
    usn: string;
    name: string;
    dept: string;
}
export interface TeacherDashboard {
    totalStudents: number;
    atRiskCount: number;
    classesToday: number;
    pendingMarksEntry: number;
    atRiskStudents: Array<{
        usn: string;
        name: string;
        risk: string;
    }>;
}
export declare class ClassesApiService {
    classes: ClassRecord[];
    rosters: Map<string, StudentRoster[]>;
    getTeacherClasses(teacherId: string): ClassRecord[];
    getAllClasses(): ClassRecord[];
    getTeacherDashboard(teacherId: string): TeacherDashboard;
    getClassStudents(classId: string): StudentRoster[];
}
