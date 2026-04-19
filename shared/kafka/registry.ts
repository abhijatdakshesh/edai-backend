/**
 * Kafka event schema registry.
 * Every service that publishes events must call validateEvent() before
 * sending to the broker.  This provides compile-time and runtime guarantees
 * that payloads conform to the shared Avro contracts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// avsc is a pure-JS Avro implementation — install: npm install avsc
// Type import kept loose so this file compiles without avsc in the host project.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const avro = require('avsc') as {
  Type: {
    forSchema: (schema: unknown) => { isValid: (payload: unknown) => boolean };
  };
};

const typeCache = new Map<string, ReturnType<typeof avro.Type.forSchema>>();

function loadType(schemaFile: string): ReturnType<typeof avro.Type.forSchema> {
  if (!typeCache.has(schemaFile)) {
    const schemaPath = join(__dirname, 'schemas', schemaFile);
    const schema: unknown = JSON.parse(readFileSync(schemaPath, 'utf8'));
    typeCache.set(schemaFile, avro.Type.forSchema(schema));
  }
  return typeCache.get(schemaFile)!;
}

export function validateEvent(schemaFile: string, payload: unknown): void {
  const type = loadType(schemaFile);
  if (!type.isValid(payload)) {
    throw new Error(
      `Event payload does not conform to Avro schema "${schemaFile}". Payload: ${JSON.stringify(payload)}`,
    );
  }
}

export const SCHEMAS = {
  AbsenteeDetected: 'AbsenteeDetected.avsc',
  CallCompleted: 'CallCompleted.avsc',
  AtRiskFlagged: 'AtRiskFlagged.avsc',
  PaymentReceived: 'PaymentReceived.avsc',
  TimelineEventCreated: 'TimelineEventCreated.avsc',
  GrievanceFiled: 'GrievanceFiled.avsc',
  MarksPublished: 'MarksPublished.avsc',
} as const;

export type SchemaKey = keyof typeof SCHEMAS;
