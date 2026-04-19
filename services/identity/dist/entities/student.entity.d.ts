export interface Student {
    id: string;
    userId: string;
    sapId: string;
    usn: string;
    name: string;
    dob: string;
    sectionId: string;
    photoUrl?: string;
    biometricRef?: string;
    institutionId: string;
    createdAt: string;
}
export interface ParentStudentLink {
    id: string;
    parentId: string;
    studentId: string;
    isPrimary: boolean;
    linkedAt: string;
}
