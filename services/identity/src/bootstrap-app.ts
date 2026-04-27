import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplication } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';

function parseCorsOrigins(): (string | RegExp)[] {
  const raw = process.env['CORS_ORIGINS'];
  if (raw && raw.trim().length > 0) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    // 10.x.x.x wildcard only in non-production (avoids arbitrary RFC-1918 access in prod)
    ...(process.env.NODE_ENV !== 'production' ? [/^http:\/\/10\.\d+\.\d+\.\d+:\d+$/] : []),
  ];
}

/**
 * Create a fully configured Nest HTTP app (Express).
 * Used by `main.ts` (listen) and Vercel serverless (`api/[[...path]].ts`).
 */
export async function createNestHttpApp(
  expressInstance?: express.Express,
): Promise<INestApplication> {
  const server = expressInstance ?? express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bufferLogs: true,
  });

  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: parseCorsOrigins(),
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('EdAI Unified API')
    .setDescription('Single API server for EdAI ERP — all frontend contracts')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  return app;
}
