export interface Course {
    id: string;
    name: string;
    code: string;
    credits: number;
    department: string;
    instructorName: string;
    instructorId: string;
    enrolled: number;
}
export interface Enrollment {
    courseId: string;
    studentUsn: string;
}
export interface AcademicSubject {
    code: string;
    name: string;
    ia: number;
    ese: number;
    total: number;
    grade: string;
}
export interface Semester {
    sem: number;
    sgpa: number;
    subjects: AcademicSubject[];
}
export interface AcademicResult {
    usn: string;
    cgpa: number;
    semesters: Semester[];
}
export declare class CoursesService {
    courses: Course[];
    enrollments: Enrollment[];
    academicResults: AcademicResult[];
    getCourses(): Course[];
    enroll(courseId: string, studentUsn: string): {
        message: string;
    };
    unenroll(courseId: string, studentUsn: string): {
        message: string;
    };
    getResults(usn: string): AcademicResult;
}
