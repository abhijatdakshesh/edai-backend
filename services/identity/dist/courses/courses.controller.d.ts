import { CoursesService } from './courses.service';
export declare class CoursesController {
    private readonly coursesService;
    constructor(coursesService: CoursesService);
    getCourses(): import("./courses.service").Course[];
    enroll(id: string, req: any): {
        message: string;
    };
    unenroll(id: string, req: any): {
        message: string;
    };
    getResults(usn: string): import("./courses.service").AcademicResult;
    getCourse(id: string): import("./courses.service").Course;
    enrollStudent(id: string, req: any): {
        message: string;
    };
}
