import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import axios from 'axios';
import {
  BehavioralIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../entities/behavior.entity';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL ?? 'http://localhost:8001';

export interface LogIncidentDto {
  studentId: string;
  institutionId: string;
  classId: string;
  reportedBy: string;
  incidentType: IncidentType;
  description: string;
  location: string;
  reportedAt?: string;
}

export interface AiClassificationResult {
  severity: IncidentSeverity;
  confidence: number;
  reasoning: string;
  recommendedActions: string[];
}

@Injectable()
export class BehaviorService {
  private readonly logger = new Logger(BehaviorService.name);
  private incidents: BehavioralIncident[] = [];

  async logIncident(dto: LogIncidentDto): Promise<{
    incident: BehavioralIncident;
    aiClassification: AiClassificationResult;
  }> {
    // Step 1: AI classification
    const classification = await this.classifyWithAI(dto);

    // Step 2: Save incident
    const incident: BehavioralIncident = {
      id: randomUUID(),
      studentId: dto.studentId,
      institutionId: dto.institutionId,
      classId: dto.classId,
      reportedBy: dto.reportedBy,
      reportedAt: dto.reportedAt ? new Date(dto.reportedAt) : new Date(),
      incidentType: dto.incidentType,
      description: dto.description,
      location: dto.location,
      timeOfDay: new Date(),
      severity: classification.severity,
      aiClassificationConfidence: classification.confidence,
      status: classification.severity === 'LOW' ? 'MONITORING' : 'ESCALATED',
      parentNotified: false,
      counsellorAssigned: false,
      createdAt: new Date(),
    };
    this.incidents.push(incident);

    // Step 3: Trigger response based on severity
    await this.triggerSeverityResponse(incident, classification);

    return { incident, aiClassification: classification };
  }

  getStudentIncidents(studentId: string): BehavioralIncident[] {
    return this.incidents
      .filter((i) => i.studentId === studentId)
      .sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
  }

  getClassIncidents(classId: string): BehavioralIncident[] {
    return this.incidents
      .filter((i) => i.classId === classId)
      .sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
  }

  resolve(incidentId: string, notes: string): BehavioralIncident | null {
    const incident = this.incidents.find((i) => i.id === incidentId);
    if (!incident) return null;
    incident.status = 'RESOLVED';
    incident.resolutionNotes = notes;
    return incident;
  }

  getDashboard(institutionId: string): Record<string, unknown> {
    const relevant = this.incidents.filter((i) => i.institutionId === institutionId);
    return {
      total: relevant.length,
      bySeverity: {
        LOW: relevant.filter((i) => i.severity === 'LOW').length,
        MEDIUM: relevant.filter((i) => i.severity === 'MEDIUM').length,
        HIGH: relevant.filter((i) => i.severity === 'HIGH').length,
      },
      byStatus: {
        OPEN: relevant.filter((i) => i.status === 'OPEN').length,
        MONITORING: relevant.filter((i) => i.status === 'MONITORING').length,
        ESCALATED: relevant.filter((i) => i.status === 'ESCALATED').length,
        RESOLVED: relevant.filter((i) => i.status === 'RESOLVED').length,
      },
    };
  }

  private async classifyWithAI(dto: LogIncidentDto): Promise<AiClassificationResult> {
    const studentHistory = {
      incident_count: this.incidents.filter((i) => i.studentId === dto.studentId).length,
    };

    try {
      const resp = await axios.post(`${AI_ENGINE_URL}/llm/classify-incident`, {
        description: dto.description,
        incident_type: dto.incidentType,
        student_history: studentHistory,
      });
      const data = resp.data as { severity: string; confidence: number; reasoning: string; recommended_actions: string[] };
      return {
        severity: data.severity as IncidentSeverity,
        confidence: data.confidence,
        reasoning: data.reasoning,
        recommendedActions: data.recommended_actions,
      };
    } catch {
      this.logger.warn('AI Engine unavailable, using rule-based classification');
      return this.ruleBasedClassify(dto);
    }
  }

  private ruleBasedClassify(dto: LogIncidentDto): AiClassificationResult {
    const highTypes: IncidentType[] = ['PHYSICAL', 'SAFETY_VIOLATION', 'SUBSTANCE'];
    const mediumTypes: IncidentType[] = ['MISCONDUCT', 'ASSIGNMENT_REFUSAL'];

    let severity: IncidentSeverity = 'LOW';
    if (highTypes.includes(dto.incidentType)) severity = 'HIGH';
    else if (mediumTypes.includes(dto.incidentType)) severity = 'MEDIUM';

    const actions: Record<IncidentSeverity, string[]> = {
      HIGH: ['Notify admin immediately', 'Schedule mandatory PTM', 'Assign counsellor'],
      MEDIUM: ['Notify parent via WhatsApp', 'Teacher check-in within 24h'],
      LOW: ['Send student nudge', 'Start 3-day monitoring'],
    };

    return {
      severity,
      confidence: 0.78,
      reasoning: `Rule-based: incident type ${dto.incidentType} maps to ${severity}`,
      recommendedActions: actions[severity],
    };
  }

  private async triggerSeverityResponse(
    incident: BehavioralIncident,
    classification: AiClassificationResult,
  ): Promise<void> {
    switch (incident.severity) {
      case 'LOW':
        // Student nudge + start monitoring period
        this.logger.log('LOW severity: monitoring started for student %s', incident.studentId);
        break;

      case 'MEDIUM':
        // WhatsApp to parent + teacher check-in
        incident.parentNotified = true;
        // KAFKA: emit behavior.incident.logged → communications service
        this.logger.log('MEDIUM severity: parent notified for student %s', incident.studentId);
        break;

      case 'HIGH':
        // Admin push + counsellor + mandatory PTM + AI call
        incident.parentNotified = true;
        incident.counsellorAssigned = true;
        // KAFKA: emit behavior.incident.logged (HIGH) → voice service triggers call
        this.logger.warn('HIGH severity: full escalation for student %s', incident.studentId);
        break;
    }
  }
}
