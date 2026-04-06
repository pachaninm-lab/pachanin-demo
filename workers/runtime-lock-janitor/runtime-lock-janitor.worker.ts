import { runtimeStore } from '../../apps/api/src/shared/runtime-store';

const intervalMs = Number(process.env.RUNTIME_LOCK_JANITOR_INTERVAL_MS || 30000);
const workerId = process.env.RUNTIME_LOCK_JANITOR_ID || 'runtime-lock-janitor';

async function tick() {
  await runtimeStore.heartbeat('runtime-lock-janitor', workerId, 'OK', { phase: 'janitor' }, 90);
  const preview = runtimeStore.previewJanitor();
  if ((preview?.summary?.staleLocks || 0) > 0 || (preview?.summary?.staleTransactions || 0) > 0) {
    await runtimeStore.runJanitor(200);
  }
}

void tick();
setInterval(() => {
  void tick();
}, intervalMs);
