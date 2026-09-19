import { runtimeStore } from '../../apps/api/src/shared/runtime-store';
import { writeStructuredLog } from '../../apps/api/src/common/logging/structured-logger';

const INTERVAL_MS = Number(process.env.RUNTIME_JANITOR_INTERVAL_MS || 30000);
const LIMIT = Number(process.env.RUNTIME_JANITOR_LIMIT || 200);
const workerId = process.env.RUNTIME_JANITOR_WORKER_ID || `runtime-janitor-${process.pid}`;

async function tick() {
  try {
    await runtimeStore.heartbeat('runtime-janitor-worker', workerId, 'RUNNING', { intervalMs: INTERVAL_MS, limit: LIMIT }, 90);
    const result = await runtimeStore.runJanitor(LIMIT);
    writeStructuredLog({
      source: 'worker.runtime-janitor',
      message: 'Janitor pass completed',
      eventType: 'runtime.janitor.completed',
      objectType: 'runtime',
      objectId: 'global',
      data: { cleaned: result.cleaned, workerId, limit: LIMIT }
    });
  } catch (error: any) {
    writeStructuredLog({
      source: 'worker.runtime-janitor',
      level: 'error',
      message: 'Janitor pass failed',
      eventType: 'runtime.janitor.failed',
      objectType: 'runtime',
      objectId: 'global',
      data: { workerId, limit: LIMIT },
      error
    });
  }
}

void tick();
setInterval(() => { void tick(); }, INTERVAL_MS);
