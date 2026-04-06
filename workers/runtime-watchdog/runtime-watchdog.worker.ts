import { runtimeStore } from '../../apps/api/src/shared/runtime-store';
import { writeStructuredLog } from '../../apps/api/src/common/logging/structured-logger';

const INTERVAL_MS = Number(process.env.RUNTIME_WATCHDOG_INTERVAL_MS || 30000);
const workerId = process.env.RUNTIME_WATCHDOG_WORKER_ID || `runtime-watchdog-${process.pid}`;

async function tick() {
  try {
    const result = await runtimeStore.health();
    writeStructuredLog({
      source: 'worker.runtime-watchdog',
      message: 'Runtime health snapshot captured',
      eventType: 'runtime.watchdog.health',
      objectType: 'runtime',
      objectId: 'global',
      data: { workerId, health: result.health }
    });
  } catch (error) {
    writeStructuredLog({
      source: 'worker.runtime-watchdog',
      level: 'error',
      message: 'Runtime watchdog failed',
      eventType: 'runtime.watchdog.failed',
      objectType: 'runtime',
      objectId: 'global',
      data: { workerId },
      error
    });
  }
}

void tick();
setInterval(() => { void tick(); }, INTERVAL_MS);
