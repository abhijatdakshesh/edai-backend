/**
 * Vercel serverless entry (compiled to dist/ — do not import from api/*.ts;
 * Vercel’s esbuild path does not preserve Nest decorator metadata).
 */
import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createNestHttpApp } from './bootstrap-app';

let nestApp: INestApplication | null = null;

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!nestApp) {
    nestApp = await createNestHttpApp();
    await nestApp.init();
  }
  const expressInstance = nestApp.getHttpAdapter().getInstance() as (
    req: Request,
    res: Response,
  ) => void;
  expressInstance(req, res);
}
