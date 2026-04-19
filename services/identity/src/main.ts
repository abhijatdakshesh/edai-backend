import 'reflect-metadata';
import { createNestHttpApp } from './bootstrap-app';

async function bootstrap(): Promise<void> {
  const app = await createNestHttpApp();
  const port = Number(process.env['PORT'] ?? 3001);
  await app.listen(port);
  console.log(`EdAI API server running on port ${port}`);
  console.log(`Swagger docs at http://localhost:${port}/docs`);
}

void bootstrap();
