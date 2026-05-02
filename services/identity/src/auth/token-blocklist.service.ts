import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const BLOCKLIST_PREFIX = 'auth:blocklist:';
const REFRESH_TTL_S = 7 * 24 * 60 * 60; // 7 days — matches refresh token expiry

@Injectable()
export class TokenBlocklistService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenBlocklistService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
    this.redis.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
    this.redis.connect().catch((err) => this.logger.warn(`Redis connect failed: ${err.message}`));
  }

  async block(token: string, ttlSeconds = REFRESH_TTL_S): Promise<void> {
    try {
      await this.redis.setex(`${BLOCKLIST_PREFIX}${token}`, ttlSeconds, '1');
    } catch (err) {
      this.logger.error(`Failed to block token: ${(err as Error).message}`);
    }
  }

  async isBlocked(token: string): Promise<boolean> {
    try {
      const val = await this.redis.get(`${BLOCKLIST_PREFIX}${token}`);
      return val === '1';
    } catch {
      // If Redis is unreachable, fail open (don't block all logins) but log loudly
      this.logger.error('Redis unreachable — blocklist check skipped (fail-open)');
      return false;
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
