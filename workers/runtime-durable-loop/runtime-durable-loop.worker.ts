import { runtimeStore } from '../../apps/api/src/shared/runtime-store';
import { writeStructuredLog } from '../../apps/api/src/common/logging/structured-logger';

const INTERVAL_MS = Number(process.env.RUNTIME_DURABLE_LOOP_INTERVAL_MS || 15000);
const workerId = process.env.RUNTIME_DURABLE_LOOP_WORKER_ID || `runtime-durable-loop-${process.pid}`;

async function tick() {
  try {
    const processed = await runtimeStore.processCommands(20, workerId);
    writeStructuredLog({
      source: 'worker.runtime-durable-loop',
      message: 'Runtime durable loop tick completed',
      eventType: 'runtime.durable-loop.tick',
      objectType: 'runtime',
      objectId: 'global',
      data: { workerId, processed }
    });
  } catch (error) {
    writeStructuredLog({
      source: 'worker.runtime-durable-loop',
      level: 'error',
      message: 'Runtime durable loop failed',
      eventType: 'runtime.durable-loop.failed',
      objectType: 'runtime',
      objectId: 'global',
      data: { workerId },
      error
    });
  }
}

void tick();
setInterval(() => { void tick(); }, INTERVAL_MS);
