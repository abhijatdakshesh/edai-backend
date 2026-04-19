import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BehavioralIncident, IncidentPattern, PatternType } from '../entities/behavior.entity';

@Injectable()
export class PatternsService {
  private readonly logger = new Logger(PatternsService.name);
  private patterns: IncidentPattern[] = [];

  /**
   * Pattern recognition engine — runs daily at 21:00 via Bull cron.
   * Analyzes students with ≥3 incidents in last 30 days.
   */
  async runPatternEngine(incidents: BehavioralIncident[]): Promise<IncidentPattern[]> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // Group by student
    const byStudent: Record<string, BehavioralIncident[]> = {};
    for (const inc of incidents) {
      if (inc.reportedAt >= since) {
        byStudent[inc.studentId] ??= [];
        byStudent[inc.studentId].push(inc);
      }
    }

    const newPatterns: IncidentPattern[] = [];
    for (const [studentId, studentIncidents] of Object.entries(byStudent)) {
      if (studentIncidents.length < 3) continue;
      newPatterns.push(...this.detectPatterns(studentId, studentIncidents));
    }

    this.patterns.push(...newPatterns);
    for (const p of newPatterns) {
      // KAFKA: emit behavior.pattern.detected
      this.logger.log('Pattern detected: %s for student %s', p.patternType, p.studentId);
    }
    return newPatterns;
  }

  getStudentPatterns(studentId: string): IncidentPattern[] {
    return this.patterns.filter((p) => p.studentId === studentId);
  }

  getInstitutionPatterns(institutionId: string): IncidentPattern[] {
    return this.patterns.filter((p) => p.institutionId === institutionId);
  }

  private detectPatterns(studentId: string, incidents: BehavioralIncident[]): IncidentPattern[] {
    const found: IncidentPattern[] = [];
    const institutionId = incidents[0]?.institutionId ?? 'default';

    // Temporal: cluster by hour
    const hourCounts: Record<number, number> = {};
    for (const inc of incidents) {
      const hour = inc.timeOfDay.getHours();
      hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
    }
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakHour && Number(peakHour[1]) >= incidents.length * 0.5) {
      found.push(this.makePattern(studentId, institutionId, 'TEMPORAL', 0.85,
        `${Math.round((Number(peakHour[1]) / incidents.length) * 100)}% of incidents occur around ${peakHour[0]}:00`,
        'Consider fatigue-related behavior or schedule stress at this hour',
      ));
    }

    // Location: cluster by location
    const locationCounts: Record<string, number> = {};
    for (const inc of incidents) {
      locationCounts[inc.location] = (locationCounts[inc.location] ?? 0) + 1;
    }
    const peakLocation = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakLocation && Number(peakLocation[1]) >= incidents.length * 0.6) {
      found.push(this.makePattern(studentId, institutionId, 'LOCATION', 0.80,
        `${Math.round((Number(peakLocation[1]) / incidents.length) * 100)}% of incidents occur at ${peakLocation[0]}`,
        `Review ${peakLocation[0]} environment — consider overcrowding or peer dynamics`,
      ));
    }

    return found;
  }

  private makePattern(
    studentId: string,
    institutionId: string,
    type: PatternType,
    confidence: number,
    description: string,
    recommendation: string,
  ): IncidentPattern {
    return {
      id: randomUUID(),
      studentId,
      institutionId,
      patternType: type,
      detectedAt: new Date(),
      confidence,
      description,
      aiRecommendation: recommendation,
      createdAt: new Date(),
    };
  }
}
