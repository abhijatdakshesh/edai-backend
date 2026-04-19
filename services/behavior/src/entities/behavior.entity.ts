export type IncidentType =
  | 'DISRUPTION'
  | 'DRESS_CODE'
  | 'LATE_ARRIVAL'
  | 'ASSIGNMENT_REFUSAL'
  | 'PHYSICAL'
  | 'MISCONDUCT'
  | 'SAFETY_VIOLATION'
  | 'SUBSTANCE'
  | 'OTHER';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type IncidentStatus = 'OPEN' | 'MONITORING' | 'ESCALATED' | 'RESOLVED';
export type PatternType = 'TEMPORAL' | 'LOCATION' | 'SUBJECT' | 'PEER_GROUP';

export interface BehavioralIncident {
  id: string;
  studentId: string;
  institutionId: string;
  classId: string;
  reportedBy: string;
  reportedAt: Date;
  incidentType: IncidentType;
  description: string;
  location: string;
  timeOfDay: Date;
  severity: IncidentSeverity;
  aiClassificationConfidence: number;
  actionTaken?: string;
  status: IncidentStatus;
  parentNotified: boolean;
  counsellorAssigned: boolean;
  resolutionNotes?: string;
  createdAt: Date;
}

export interface IncidentPattern {
  id: string;
  studentId: string;
  institutionId: string;
  patternType: PatternType;
  detectedAt: Date;
  confidence: number;
  description: string;
  aiRecommendation: string;
  createdAt: Date;
}
