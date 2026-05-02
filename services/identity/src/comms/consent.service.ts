import { Injectable, ForbiddenException, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';

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
 * Write-through cache: in-memory for sync reads, DB-backed for durability.
 * Hydrates from DB on startup so consent survives server restarts.
 */
@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);
  /** key = `${principalId}::${institutionId}` — stores active and recently revoked records */
  private cache: Map<string, ConsentRecord> = new Map();

  /** Exposes all cached records (active + revoked) for testing and audit. */
  get records(): ConsentRecord[] {
    return Array.from(this.cache.values());
  }

  constructor(@Optional() @InjectDataSource() private readonly ds: DataSource | null) {
    if (this.ds) {
      this.hydrateFromDb().catch(e => this.logger.warn('Consent hydration skipped (no DB?)', e));
    }
  }

  private key(principalId: string, institutionId: string): string {
    return `${principalId}::${institutionId}`;
  }

  private async hydrateFromDb(): Promise<void> {
    if (!this.ds) return;
    const rows = await this.ds.query(
      `SELECT principal_id, institution_id, channels, granted_at, revoked_at, active
       FROM consent_records WHERE active = true`,
    );
    for (const row of rows as Record<string, unknown>[]) {
      const record: ConsentRecord = {
        principalId: String(row['principal_id']),
        institutionId: String(row['institution_id']),
        channels: row['channels'] as ConsentChannel[],
        grantedAt: String(row['granted_at']),
        active: true,
      };
      this.cache.set(this.key(record.principalId, record.institutionId), record);
    }
    this.logger.log(`Consent cache hydrated: ${this.cache.size} active records`);
  }

  grant(principalId: string, channels: ConsentChannel[], institutionId = 'default'): ConsentRecord {
    const k = this.key(principalId, institutionId);
    const existing = this.cache.get(k);
    if (existing) {
      const merged = Array.from(new Set([...existing.channels, ...channels])) as ConsentChannel[];
      existing.channels = merged;
      this.ds?.query(
        `UPDATE consent_records SET channels = $1 WHERE principal_id = $2 AND institution_id = $3 AND active = true`,
        [merged, principalId, institutionId],
      ).catch(e => this.logger.warn('Consent update failed', e));
      return existing;
    }
    const record: ConsentRecord = {
      principalId, institutionId, channels,
      grantedAt: new Date().toISOString(), active: true,
    };
    this.cache.set(k, record);
    this.ds?.query(
      `INSERT INTO consent_records (id, principal_id, institution_id, channels, active, granted_at)
       VALUES ($1, $2, $3, $4, true, NOW()) ON CONFLICT DO NOTHING`,
      [randomUUID(), principalId, institutionId, channels],
    ).catch(e => this.logger.warn('Consent insert failed', e));
    return record;
  }

  revoke(principalId: string, channels: ConsentChannel[], institutionId = 'default'): void {
    const k = this.key(principalId, institutionId);
    const record = this.cache.get(k);
    if (!record) return;
    record.channels = record.channels.filter(c => !channels.includes(c));
    if (record.channels.length === 0) {
      record.active = false;
      record.revokedAt = new Date().toISOString();
      this.ds?.query(
        `UPDATE consent_records SET active = false, revoked_at = NOW() WHERE principal_id = $1 AND institution_id = $2 AND active = true`,
        [principalId, institutionId],
      ).catch(e => this.logger.warn('Consent revoke failed', e));
    } else {
      this.ds?.query(
        `UPDATE consent_records SET channels = $1 WHERE principal_id = $2 AND institution_id = $3 AND active = true`,
        [record.channels, principalId, institutionId],
      ).catch(e => this.logger.warn('Consent channel update failed', e));
    }
  }

  revokeAll(principalId: string, institutionId = 'default'): void {
    const k = this.key(principalId, institutionId);
    const record = this.cache.get(k);
    if (!record) return;
    record.active = false;
    record.channels = [];
    record.revokedAt = new Date().toISOString();
    this.ds?.query(
      `UPDATE consent_records SET active = false, channels = '{}', revoked_at = NOW()
       WHERE principal_id = $1 AND institution_id = $2 AND active = true`,
      [principalId, institutionId],
    ).catch(e => this.logger.warn('Consent revokeAll failed', e));
  }

  assertConsent(principalId: string, channel: ConsentChannel, institutionId = 'default'): void {
    const record = this.cache.get(this.key(principalId, institutionId));
    if (!record || !record.active || !record.channels.includes(channel)) {
      throw new ForbiddenException(
        `DPDP consent not granted: principal ${principalId} has not consented to ${channel} communications`,
      );
    }
  }

  hasConsent(principalId: string, channel: ConsentChannel, institutionId = 'default'): boolean {
    const record = this.cache.get(this.key(principalId, institutionId));
    return !!record && record.active && record.channels.includes(channel);
  }

  getConsent(principalId: string, institutionId = 'default'): ConsentRecord | null {
    const record = this.cache.get(this.key(principalId, institutionId));
    return record?.active ? record : null;
  }
}
