import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';
import { PromotionBatchEntity, PromotionAuditEntity } from '../entities/promotion-batch.entity';

@Module({
  imports: process.env['DATABASE_URL']
    ? [TypeOrmModule.forFeature([PromotionBatchEntity, PromotionAuditEntity])]
    : [],
  controllers: [PromotionController],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
