export async function processRuntimeCommands(params: {
  dbEnabled: boolean;
  limit: number;
  workerId: string;
  commandIds?: string[];
  acquireLease: (workerName: string, holderId: string, ttlSeconds?: number) => Promise<any>;
  releaseLease: (workerName: string, holderId: string) => Promise<any>;
  heartbeat: (workerName: string, holderId: string, status?: string, metrics?: Record<string, any>, ttlSeconds?: number) => Promise<any>;
  claimPendingCommands: (limit: number, workerId: string, commandIds?: string[]) => Promise<any[]>;
  acquireObjectLock: (objectType: string, objectId: string, holderId: string, ttlSeconds?: number, metadata?: Record<string, any>) => Promise<any>;
  releaseObjectLock: (objectType: string, objectId: string, holderId: string) => Promise<any>;
  runInTransaction: (boundary: string, metadata: Record<string, any>, executor: () => Promise<any>) => Promise<any>;
  executeQueuedCommand: (command: any) => Promise<any>;
  saveCommand: (record: any) => Promise<any>;
  appendMetric: (name: string, scope: string, valueFloat: number, labels?: Record<string, any>) => Promise<any>;
  pushEvent: (action: string, message: string, payload?: Record<string, any>) => any;
  buildMeta: () => any;
  resolveLockTarget: (action: string, payload: Record<string, any>) => { objectType: string; objectId: string } | null;
}) {
  const {
    dbEnabled,
    limit,
    workerId,
    commandIds,
    acquireLease,
    releaseLease,
    heartbeat,
    claimPendingCommands,
    acquireObjectLock,
    releaseObjectLock,
    runInTransaction,
    executeQueuedCommand,
    saveCommand,
    appendMetric,
    pushEvent,
    buildMeta,
    resolveLockTarget
  } = params;

  if (!dbEnabled) {
    return {
      meta: buildMeta(),
      processed: [],
      skipped: [],
      workerId
    };
  }

  const lease = await acquireLease('runtime-command-worker', workerId, 90);
  if (!lease) {
    return {
      meta: buildMeta(),
      skipped: true,
      reason: 'lease_not_acquired',
      workerId
    };
  }

  await heartbeat('runtime-command-worker', workerId, 'RUNNING', { phase: 'claim', limit }, 90);
  const claimed = await claimPendingCommands(limit, workerId, commandIds);
  const processed: any[] = [];
  const skipped: any[] = [];

  try {
    for (const command of claimed) {
      const payload = (command.payload || {}) as Record<string, any>;
      const lockTarget = resolveLockTarget(command.action, payload);
      let lockHolder: any = null;

      if (lockTarget?.objectType && lockTarget?.objectId) {
        lockHolder = await acquireObjectLock(lockTarget.objectType, lockTarget.objectId, workerId, 75, {
          source: 'command',
          commandId: command.id,
          action: command.action
        });
        if (!lockHolder) {
          const stored = await saveCommand({
            id: command.id,
            idempotencyKey: command.idempotencyKey,
            action: command.action,
            status: 'FAILED',
            payload: command.payload,
            error: 'object_lock_not_acquired'
          });
          skipped.push({ id: command.id, status: 'FAILED', error: stored?.error || 'object_lock_not_acquired', lockTarget });
          continue;
        }
      }

      try {
        const result = await runInTransaction('process_runtime_command', { scope: 'global', commandId: command.id, action: command.action }, async () => {
          return await executeQueuedCommand(command);
        });
        const stored = await saveCommand({
          id: command.id,
          idempotencyKey: command.idempotencyKey,
          action: command.action,
          status: 'SUCCEEDED',
          payload: command.payload,
          result
        });
        processed.push({ id: command.id, status: 'SUCCEEDED', result: stored?.result || result, lockTarget });
      } catch (error: any) {
        const stored = await saveCommand({
          id: command.id,
          idempotencyKey: command.idempotencyKey,
          action: command.action,
          status: 'FAILED',
          payload: command.payload,
          error: error?.message || 'runtime_command_failed'
        });
        processed.push({ id: command.id, status: 'FAILED', error: stored?.error || error?.message || 'runtime_command_failed', lockTarget });
      } finally {
        if (lockHolder && lockTarget) await releaseObjectLock(lockTarget.objectType, lockTarget.objectId, workerId);
      }
    }

    await heartbeat('runtime-command-worker', workerId, skipped.length ? 'WARNING' : 'OK', { processed: processed.length, skipped: skipped.length }, 90);
    if (processed.length || skipped.length) {
      await appendMetric('runtime.commands.processed', 'global', processed.filter((item) => item.status === 'SUCCEEDED').length, { workerId });
      await appendMetric('runtime.commands.failed', 'global', [...processed, ...skipped].filter((item) => item.status === 'FAILED').length, { workerId });
    }
    if (processed.length || skipped.length) {
      pushEvent('process_commands', `Processed ${processed.length} runtime command(s)`, { count: processed.length, skipped: skipped.length, workerId });
    }
    return {
      meta: buildMeta(),
      processed,
      skipped,
      workerId
    };
  } finally {
    await releaseLease('runtime-command-worker', workerId);
  }
}
