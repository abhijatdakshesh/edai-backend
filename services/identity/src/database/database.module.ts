import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeItemEntity } from '../entities/fee-item.entity';
import { PromotionBatchEntity, PromotionAuditEntity } from '../entities/promotion-batch.entity';
import { VtuWindowEntity, VtuEligibilityEntity, VtuRegistrationEntity } from '../entities/vtu.entity';
import { AiCallLogEntity, ConsentRecordEntity, AnnouncementEntity } from '../entities/comms.entity';
import { StudentEntity, ParentStudentLinkEntity } from '../entities/student-orm.entity';
import { PlacementDriveEntity, AlumniOutcomeEntity } from '../entities/placement.entity';

const ALL_ENTITIES = [
  StudentEntity,
  ParentStudentLinkEntity,
  FeeItemEntity,
  PromotionBatchEntity,
  PromotionAuditEntity,
  VtuWindowEntity,
  VtuEligibilityEntity,
  VtuRegistrationEntity,
  AiCallLogEntity,
  ConsentRecordEntity,
  AnnouncementEntity,
  PlacementDriveEntity,
  AlumniOutcomeEntity,
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
          // synchronize only in dev/test — never in production.
          // Columns added to entities (semester, section, department, preferred_language)
          // are handled by migration 006_students_chatbot_columns so synchronize:true
          // won't wipe manually-populated data; it only runs ALTER TABLE ADD COLUMN IF NOT EXISTS.
          synchronize: false,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          logging: false,
          // Pool sizing: knowledge-graph fires 4–7 parallel queries per request;
          // with multiple concurrent WS connections the default pool of 10 saturates
          // and pg emits "client.query() called while query already executing".
          extra: {
            max: parseInt(process.env['DB_POOL_MAX'] ?? '20', 10),
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
          },
        }),
        TypeOrmModule.forFeature(ALL_ENTITIES),
      ]
    : [],
  exports: process.env['DATABASE_URL'] ? [TypeOrmModule] : [],
})
export class DatabaseModule {}
