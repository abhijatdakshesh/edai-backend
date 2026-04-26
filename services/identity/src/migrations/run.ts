/**
 * Run TypeORM migrations manually.
 * Usage: DATABASE_URL=postgresql://... npx ts-node src/migrations/run.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FeeItemEntity } from '../entities/fee-item.entity';
import { PromotionBatchEntity, PromotionAuditEntity } from '../entities/promotion-batch.entity';
import { VtuWindowEntity, VtuEligibilityEntity, VtuRegistrationEntity } from '../entities/vtu.entity';
import { AiCallLogEntity, ConsentRecordEntity, AnnouncementEntity } from '../entities/comms.entity';

const ds = new DataSource({
  type: 'postgres',
  url: process.env['DATABASE_URL'],
  entities: [
    FeeItemEntity,
    PromotionBatchEntity,
    PromotionAuditEntity,
    VtuWindowEntity,
    VtuEligibilityEntity,
    VtuRegistrationEntity,
    AiCallLogEntity,
    ConsentRecordEntity,
    AnnouncementEntity,
  ],
  synchronize: false,
  migrations: [__dirname + '/*.migration.ts'],
});

ds.initialize()
  .then(() => ds.runMigrations({ transaction: 'all' }))
  .then(() => { console.log('Migrations complete'); process.exit(0); })
  .catch((e) => { console.error('Migration failed:', e); process.exit(1); });
