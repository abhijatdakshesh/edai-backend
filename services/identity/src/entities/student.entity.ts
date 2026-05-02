export interface Student {
  id: string;
  userId: string;
  sapId?: string;
  usn: string;
  name: string;
  dob?: string;
  sectionId?: string;
  semester?: number;
  section?: string;
  department?: string;
  preferredLanguage?: string;
  photoUrl?: string;
  biometricRef?: string;
  institutionId: string;
  homeState?: string;
  parentPhone?: string;
  parentName?: string;
  consentVoice?: boolean;
  parentPreferredLanguage?: string;
  createdAt: string;
}

export interface ParentStudentLink {
  id: string;
  parentId: string;
  studentId: string;
  isPrimary: boolean;
  linkedAt: string;
}
