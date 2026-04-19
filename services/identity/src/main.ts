import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001', /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/],
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

  await app.listen(process.env['PORT'] ?? 3001);
  console.log(`EdAI API server running on port ${process.env['PORT'] ?? 3001}`);
  console.log(`Swagger docs at http://localhost:${process.env['PORT'] ?? 3001}/docs`);
}

void bootstrap();
