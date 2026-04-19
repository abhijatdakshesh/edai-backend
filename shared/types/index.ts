export type UserRole =
  | 'STUDENT'
  | 'PARENT'
  | 'FACULTY'
  | 'HOD'
  | 'DEAN'
  | 'PRINCIPAL'
  | 'TRUSTEE'
  | 'COUNSELLOR'
  | 'ADMIN';

export type Language = 'kn' | 'en' | 'hi' | 'ta' | 'te' | 'ml';

export type InstitutionId = 'rvce' | 'rvitm' | string;

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  institutionId: InstitutionId;
  iat: number;
  exp: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface BaseEvent {
  eventId: string;
  eventVersion: string;
  occurredAt: number;
}
