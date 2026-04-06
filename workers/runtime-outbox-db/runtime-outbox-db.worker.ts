import { RuntimeDbPersistence } from '../../apps/api/src/shared/runtime-db-persistence';

export async function processDatabaseOutbox(limit = 50, workerId = `worker-${process.pid}`) {
  const persistence = new RuntimeDbPersistence();
  const claimed = await persistence.claimDueOutbox(limit, workerId);
  const processed: Array<{ id: string; status: string }> = [];

  for (const item of claimed) {
    try {
      const topic = String(item.topic || '');
      const degraded = /connector|gps|bank|edo|fgis/i.test(topic) && String((item.payload as any)?.error || '').length > 0;
      const outcome = degraded
        ? await persistence.markOutboxFailed(item.id, 'connector_runtime_degraded')
        : await persistence.markOutboxProcessed(item.id, 'PROCESSED');
      if (outcome) processed.push({ id: outcome.id, status: outcome.status });
    } catch (error: any) {
      const outcome = await persistence.markOutboxFailed(item.id, error?.message || 'runtime_outbox_worker_failed');
      if (outcome) processed.push({ id: outcome.id, status: outcome.status });
    }
  }

  return { workerId, claimed: claimed.length, processed };
}
