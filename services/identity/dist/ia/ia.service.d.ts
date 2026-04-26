export interface IAEntry {
    usn: string;
    name: string;
    ia1: number;
    ia2: number;
    ia3: number;
    subjectCode: string;
    sem: number;
}
export interface IASubmission {
    id: string;
    teacherId: string;
    subjectCode: string;
    sem: number;
    submittedAt: string;
    status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED';
}
export declare class IaService {
    entries: IAEntry[];
    submissions: IASubmission[];
    getMarks(subjectCode: string, sem: number): IAEntry[];
    saveMarks(subjectCode: string, sem: number, marks: Array<{
        usn: string;
        ia1: number;
        ia2: number;
        ia3: number;
    }>, teacherId: string): IASubmission;
    submitForReview(subjectCode: string, sem: number, teacherId: string): IASubmission;
    getAllSubmissions(): IASubmission[];
    confirm(id: string): IASubmission;
    sendReminders(teacherIds: string[]): {
        reminded: string[];
    };
    uploadResults(subjectCode: string, sem: number): {
        message: string;
    };
    getMarksBySubject(subjectId: string): IAEntry[];
}
