export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'HOLIDAY';
export type AttendanceSource = 'MANUAL' | 'BIOMETRIC' | 'GEOFENCE' | 'IMPORTED';
export type Language = 'kn' | 'en' | 'hi' | 'ta' | 'te' | 'ml';
export type EscalationLevel = 'DAY3' | 'DAY5' | 'DAY7' | 'DAY10';
export type EscalationAction =
  | 'CALL'
  | 'WHATSAPP_EMAIL'
  | 'TEACHER_ALERT'
  | 'PTM_SCHEDULED';

export interface CallPreferenceTime {
  from: string; // HH:mm
  to: string;   // HH:mm
}

export interface Student {
  id: string;
  institutionId: string;
  name: string;
  rollNumber: string;
  classId: string;
  section: string;
  admissionYear: number;
  photoUrl?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Parent {
  id: string;
  studentId: string;
  name: string;
  relation: 'FATHER' | 'MOTHER' | 'GUARDIAN';
  /** KMS-encrypted phone token */
  phoneToken: string;
  whatsapp?: string;
  email?: string;
  preferredLanguage: Language;
  callPreferenceTime: CallPreferenceTime;
  consentVoice: boolean;
  consentWhatsapp: boolean;
  createdAt: Date;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  institutionId: string;
  classId: string;
  subjectId?: string;
  date: string; // ISO date
  period?: number;
  markedAt: Date;
  status: AttendanceStatus;
  markedBy: string; // teacher_id
  source: AttendanceSource;
  absenceReason?: string;
  callTriggered: boolean;
  createdAt: Date;
}

export interface AbsenceEscalation {
  id: string;
  studentId: string;
  institutionId: string;
  windowStart: string;
  windowEnd: string;
  absenceCount: number;
  escalationLevel: EscalationLevel;
  actionTaken: EscalationAction;
  triggeredAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface PTMBooking {
  id: string;
  studentId: string;
  teacherId: string;
  parentId: string;
  institutionId: string;
  scheduledAt: Date;
  durationMinutes: number;
  type: 'ONLINE' | 'IN_PERSON';
  meetingLink?: string;
  status: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  triggerReason: string;
  reminderSent: boolean;
  createdAt: Date;
}
