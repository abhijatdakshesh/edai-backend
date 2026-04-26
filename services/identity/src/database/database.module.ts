import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeItemEntity } from '../entities/fee-item.entity';
import { PromotionBatchEntity, PromotionAuditEntity } from '../entities/promotion-batch.entity';
import { VtuWindowEntity, VtuEligibilityEntity, VtuRegistrationEntity } from '../entities/vtu.entity';
import { AiCallLogEntity, ConsentRecordEntity, AnnouncementEntity } from '../entities/comms.entity';

const ALL_ENTITIES = [
  FeeItemEntity,
  PromotionBatchEntity,
  PromotionAuditEntity,
  VtuWindowEntity,
  VtuEligibilityEntity,
  VtuRegistrationEntity,
  AiCallLogEntity,
  ConsentRecordEntity,
  AnnouncementEntity,
];

/**
 * Conditionally connects to PostgreSQL when DATABASE_URL is set.
 * Falls back to no-op (in-memory services continue working) when DATABASE_URL is absent.
 * This allows tests to run without a running database.
 */
@Module({
  imports: process.env['DATABASE_URL']
    ? [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['DATABASE_URL'],
          entities: ALL_ENTITIES,
          synchronize: process.env.NODE_ENV !== 'production',
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          logging: false,
        }),
        TypeOrmModule.forFeature(ALL_ENTITIES),
      ]
    : [],
  exports: process.env['DATABASE_URL'] ? [TypeOrmModule] : [],
})
export class DatabaseModule {}
