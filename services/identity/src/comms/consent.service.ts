import { Injectable, ForbiddenException } from '@nestjs/common';

export type ConsentChannel = 'ATTENDANCE_ALERTS' | 'FEES_ALERTS' | 'MARKS_ALERTS' | 'GENERAL';

export interface ConsentRecord {
  principalId: string;
  institutionId: string;
  channels: ConsentChannel[];
  grantedAt: string;
  revokedAt?: string;
  active: boolean;
}

/**
 * ConsentService — DPDP Act 2023 compliance gate.
 * Stores consent per principalId + institutionId + channel.
 * Must be called before any outbound communication (SMS, WhatsApp, AI voice call).
 * Production: replace this.records with TypeORM ConsentRecord entity.
 */
@Injectable()
export class ConsentService {
  records: ConsentRecord[] = [];

  grant(principalId: string, channels: ConsentChannel[], institutionId = 'default'): ConsentRecord {
    const existing = this.findActive(principalId, institutionId);
    if (existing) {
      // Merge channels — avoid duplicates
      const merged = Array.from(new Set([...existing.channels, ...channels])) as ConsentChannel[];
      existing.channels = merged;
      return existing;
    }
    const record: ConsentRecord = {
      principalId,
      institutionId,
      channels,
      grantedAt: new Date().toISOString(),
      active: true,
    };
    this.records.push(record);
    return record;
  }

  revoke(principalId: string, channels: ConsentChannel[], institutionId = 'default'): void {
    const record = this.findActive(principalId, institutionId);
    if (!record) return;
    record.channels = record.channels.filter((c) => !channels.includes(c));
    if (record.channels.length === 0) {
      record.active = false;
      record.revokedAt = new Date().toISOString();
    }
  }

  revokeAll(principalId: string, institutionId = 'default'): void {
    const record = this.findActive(principalId, institutionId);
    if (!record) return;
    record.active = false;
    record.channels = [];
    record.revokedAt = new Date().toISOString();
  }

  /**
   * Throws ForbiddenException if the principal has not consented to the given channel.
   * Call this at the start of every outbound comms method.
   */
  assertConsent(principalId: string, channel: ConsentChannel, institutionId = 'default'): void {
    const record = this.findActive(principalId, institutionId);
    if (!record || !record.channels.includes(channel)) {
      throw new ForbiddenException(
        `DPDP consent not granted: principal ${principalId} has not consented to ${channel} communications`,
      );
    }
  }

  hasConsent(principalId: string, channel: ConsentChannel, institutionId = 'default'): boolean {
    const record = this.findActive(principalId, institutionId);
    return !!record && record.channels.includes(channel);
  }

  getConsent(principalId: string, institutionId = 'default'): ConsentRecord | null {
    return this.findActive(principalId, institutionId) ?? null;
  }

  private findActive(principalId: string, institutionId: string): ConsentRecord | undefined {
    return this.records.find(
      (r) => r.principalId === principalId && r.institutionId === institutionId && r.active,
    );
  }
}
