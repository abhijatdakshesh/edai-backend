/**
 * KafkaProducerService — unit tests
 *
 * kafkajs is mocked so no broker is needed.
 * Covers: connect/disconnect lifecycle, emitRiskScored, emitAlertTriggered,
 *         silent no-op when not connected.
 */

jest.mock('kafkajs', () => {
  const send = jest.fn().mockResolvedValue(undefined);
  const connect = jest.fn().mockResolvedValue(undefined);
  const disconnect = jest.fn().mockResolvedValue(undefined);
  const producer = jest.fn(() => ({ send, connect, disconnect }));
  const Kafka = jest.fn(() => ({ producer }));
  return { Kafka, Partitioners: { DefaultPartitioner: 'default' }, __mocks: { send, connect, disconnect, producer, Kafka } };
});

import { KafkaProducerService } from './kafka-producer.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mocks } = require('kafkajs') as { __mocks: { send: jest.Mock; connect: jest.Mock; disconnect: jest.Mock; producer: jest.Mock; Kafka: jest.Mock } };

describe('KafkaProducerService', () => {
  let service: KafkaProducerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KafkaProducerService(['localhost:9092']);
  });

  it('connects to Kafka on module init', async () => {
    await service.onModuleInit();
    expect(__mocks.connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects from Kafka on module destroy after connect', async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();
    expect(__mocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not disconnect if never connected', async () => {
    await service.onModuleDestroy();
    expect(__mocks.disconnect).not.toHaveBeenCalled();
  });

  it('emits ews.risk.scored with correct topic and key', async () => {
    await service.onModuleInit();
    const event = {
      studentId: 'stu-1',
      academicYear: '2025-2026',
      semester: 5,
      score: 45,
      level: 'MEDIUM',
      factors: {},
      snapshotId: 'snap-1',
      ts: new Date().toISOString(),
    };
    await service.emitRiskScored(event);
    expect(__mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'ews.risk.scored',
        messages: [expect.objectContaining({ key: 'stu-1' })],
      }),
    );
  });

  it('emits ews.alert.triggered with correct topic and key', async () => {
    await service.onModuleInit();
    const event = {
      studentId: 'stu-2',
      snapshotId: 'snap-2',
      level: 'HIGH',
      ruleId: 'rule-1',
      notifyRoles: ['FACULTY'],
      ts: new Date().toISOString(),
    };
    await service.emitAlertTriggered(event);
    expect(__mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'ews.alert.triggered',
        messages: [expect.objectContaining({ key: 'stu-2' })],
      }),
    );
  });

  it('silently no-ops emitRiskScored when not connected', async () => {
    // No onModuleInit call
    await service.emitRiskScored({ studentId: 'x', academicYear: '', semester: 1, score: 0, level: 'LOW', factors: {}, snapshotId: '', ts: '' });
    expect(__mocks.send).not.toHaveBeenCalled();
  });

  it('silently no-ops emitAlertTriggered when not connected', async () => {
    await service.emitAlertTriggered({ studentId: 'x', snapshotId: '', level: 'LOW', ruleId: '', notifyRoles: [], ts: '' });
    expect(__mocks.send).not.toHaveBeenCalled();
  });

  it('serializes event to JSON in message value', async () => {
    await service.onModuleInit();
    const event = { studentId: 'stu-3', academicYear: '2025-2026', semester: 3, score: 70, level: 'HIGH', factors: { attendance: 80 }, snapshotId: 'snap-3', ts: 'now' };
    await service.emitRiskScored(event);
    const call = __mocks.send.mock.calls[0][0] as { messages: { value: string }[] };
    const parsed = JSON.parse(call.messages[0].value) as typeof event;
    expect(parsed.studentId).toBe('stu-3');
    expect(parsed.score).toBe(70);
  });
});
