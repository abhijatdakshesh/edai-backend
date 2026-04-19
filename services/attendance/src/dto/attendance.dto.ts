import { AttendanceStatus, AttendanceSource } from '../entities/attendance-record.entity';

export interface MarkAttendanceDto {
  studentId: string;
  classId: string;
  subjectId?: string;
  date: string;
  period?: number;
  status: AttendanceStatus;
  markedBy: string;
  source?: AttendanceSource;
}

export interface BulkAttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
}

export interface MarkBulkAttendanceDto {
  classId: string;
  date: string;
  period?: number;
  subjectId?: string;
  records: BulkAttendanceEntry[];
  markedBy: string;
}

export interface ExcuseAbsenceDto {
  reason: string;
}

export interface AttendanceAbsentMarkedEvent {
  eventId: string;
  studentId: string;
  studentName: string;
  classId: string;
  institutionId: string;
  date: string;
  period?: number;
  parentId: string;
  parentPhoneToken: string;
  parentLanguage: string;
  consentVoice: boolean;
  consentWhatsapp: boolean;
  teacherId: string;
  markedAt: number; // Unix ms
}
