import { KafkaProducerService } from './kafka-producer.service';

describe('KafkaProducerService topology contract', () => {
  const original = {
    brokers: process.env.KAFKA_BROKERS,
    required: process.env.KAFKA_REQUIRED,
    clientId: process.env.KAFKA_CLIENT_ID,
    component: process.env.RUNTIME_COMPONENT,
  };

  afterEach(() => {
    if (original.brokers === undefined) delete process.env.KAFKA_BROKERS;
    else process.env.KAFKA_BROKERS = original.brokers;
    if (original.required === undefined) delete process.env.KAFKA_REQUIRED;
    else process.env.KAFKA_REQUIRED = original.required;
    if (original.clientId === undefined) delete process.env.KAFKA_CLIENT_ID;
    else process.env.KAFKA_CLIENT_ID = original.clientId;
    if (original.component === undefined) delete process.env.RUNTIME_COMPONENT;
    else process.env.RUNTIME_COMPONENT = original.component;
  });

  it('remains fail closed when Kafka is optional but not configured', async () => {
    delete process.env.KAFKA_BROKERS;
    delete process.env.KAFKA_REQUIRED;
    process.env.RUNTIME_COMPONENT = 'api';
    const service = new KafkaProducerService();

    await service.onModuleInit();

    expect(service.health()).toEqual(expect.objectContaining({
      required: false,
      configured: false,
      connected: false,
    }));
    await expect(service.isReady()).resolves.toBe(false);
    await expect(service.send({ topic: 'domain', value: { ok: true } })).resolves.toBe(false);
  });

  it('blocks worker startup when Kafka is required but not configured', async () => {
    delete process.env.KAFKA_BROKERS;
    process.env.KAFKA_REQUIRED = 'true';
    const service = new KafkaProducerService();

    await expect(service.onModuleInit()).rejects.toThrow(
      'KAFKA_BROKERS not set — Kafka producer disabled; KAFKA_REQUIRED=true',
    );
  });

  it('uses an explicit per-pod client identity without a shared transactional identity', () => {
    delete process.env.KAFKA_BROKERS;
    process.env.KAFKA_CLIENT_ID = 'grainflow-outbox-worker-7d9f6';
    process.env.RUNTIME_COMPONENT = 'outbox-worker';
    const service = new KafkaProducerService();

    expect(service.health()).toEqual({
      required: false,
      configured: false,
      connected: false,
      clientId: 'grainflow-outbox-worker-7d9f6',
    });
  });

  it('probes broker readiness instead of trusting the startup connection flag', async () => {
    const service = new KafkaProducerService();
    const describeCluster = jest.fn().mockResolvedValue({
      brokers: [],
      controller: null,
      clusterId: 'test-cluster',
    });
    const state = service as unknown as {
      connected: boolean;
      producer: object | null;
      admin: { describeCluster: typeof describeCluster } | null;
    };
    state.connected = true;
    state.producer = {};
    state.admin = { describeCluster };

    await expect(service.isReady()).resolves.toBe(true);
    expect(describeCluster).toHaveBeenCalledTimes(1);
  });

  it('reports not-ready when a live broker probe fails after startup', async () => {
    const service = new KafkaProducerService();
    const describeCluster = jest.fn().mockRejectedValue(new Error('broker unavailable'));
    const state = service as unknown as {
      connected: boolean;
      producer: object | null;
      admin: { describeCluster: typeof describeCluster } | null;
    };
    state.connected = true;
    state.producer = {};
    state.admin = { describeCluster };

    await expect(service.isReady()).resolves.toBe(false);
    expect(service.isConnected()).toBe(true);
    expect(describeCluster).toHaveBeenCalledTimes(1);
  });
});
