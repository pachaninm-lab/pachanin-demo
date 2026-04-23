import { describe, expect, it } from 'vitest';
import { appendActionLogEntry, createActionLogEntry, filterActionLogByObject, summarizeActionLog } from '@/lib/platform-v7/action-log';

describe('platform-v7 action log', () => {
  it('creates a normalized action log entry', () => {
    const entry = createActionLogEntry({
      scope: 'deal',
      status: 'success',
      objectId: 'DL-9102',
      action: 'remove-blocker',
      message: 'Blocker removed',
      actor: 'operator',
      at: '2026-04-23T10:00:00Z',
    });

    expect(entry.id).toContain('DL-9102-remove-blocker');
    expect(entry.actor).toBe('operator');
    expect(entry.status).toBe('success');
  });

  it('sorts new entries by time descending', () => {
    const first = createActionLogEntry({ scope: 'deal', status: 'started', objectId: 'DL-1', action: 'a', message: 'first', at: '2026-04-23T10:00:00Z' });
    const second = createActionLogEntry({ scope: 'deal', status: 'success', objectId: 'DL-2', action: 'b', message: 'second', at: '2026-04-23T11:00:00Z' });

    const log = appendActionLogEntry([first], second);
    expect(log[0]?.objectId).toBe('DL-2');
  });

  it('filters entries by object id', () => {
    const log = [
      createActionLogEntry({ scope: 'deal', status: 'success', objectId: 'DL-1', action: 'a', message: 'one', at: '2026-04-23T10:00:00Z' }),
      createActionLogEntry({ scope: 'deal', status: 'error', objectId: 'DL-2', action: 'b', message: 'two', at: '2026-04-23T11:00:00Z' }),
    ];

    expect(filterActionLogByObject(log, 'DL-2')).toHaveLength(1);
  });

  it('summarizes log statuses', () => {
    const log = [
      createActionLogEntry({ scope: 'bank', status: 'started', objectId: 'DL-1', action: 'release', message: 'started' }),
      createActionLogEntry({ scope: 'bank', status: 'success', objectId: 'DL-1', action: 'release', message: 'done' }),
      createActionLogEntry({ scope: 'bank', status: 'error', objectId: 'DL-2', action: 'release', message: 'failed' }),
    ];

    expect(summarizeActionLog(log)).toEqual({ total: 3, success: 1, error: 1, started: 1 });
  });
});
