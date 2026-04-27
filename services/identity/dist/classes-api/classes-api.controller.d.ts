import { ClassesApiService } from './classes-api.service';
export declare class ClassesApiController {
    private readonly svc;
    constructor(svc: ClassesApiService);
    getTeacherClasses(req: any): import("./classes-api.service").ClassRecord[];
    getTeacherDashboard(req: any): import("./classes-api.service").TeacherDashboard;
    getAllClasses(): import("./classes-api.service").ClassRecord[];
    getClass(id: string): import("./classes-api.service").ClassRecord;
    getStudentsForClass(classId: string): {
        usn: string;
        name: string;
        attendancePct: number;
    }[];
}
