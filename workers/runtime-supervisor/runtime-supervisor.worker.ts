import { processDatabaseOutbox } from '../runtime-outbox-db/runtime-outbox-db.worker';
import { runtimeStore } from '../../apps/api/src/shared/runtime-store';

export async function runRuntimeSupervisor(limit = 25, workerId = `runtime-supervisor-${process.pid}`) {
  const commands = await runtimeStore.processCommands(limit, `${workerId}:commands`);
  const outbox = await processDatabaseOutbox(limit, `${workerId}:outbox`);
  const leases = await runtimeStore.listLeases();
  return {
    workerId,
    commands,
    outbox,
    leases
  };
}
