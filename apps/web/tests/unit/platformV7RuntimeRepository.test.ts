import { describe, expect, it } from 'vitest';
import { assertDurableRepository, type PlatformV7RuntimeRepository } from '@/lib/platform-v7/runtime-repository';

function repository(durable: boolean): PlatformV7RuntimeRepository {
  return {
    mode: durable ? 'postgres' : 'memory',
    durable,
    async findCommandByIdempotencyKey() {
      return null;
    },
    async appendCommandEventAndSnapshot(input) {
      return { command: input.command, event: input.event, snapshot: input.snapshot, idempotent: false };
    },
    async getLatestSnapshot() {
      return null;
    },
    async listEvents() {
      return [];
    },
  };
}

describe('platform-v7 runtime repository contract', () => {
  it('allows an explicitly durable repository', () => {
    expect(() => assertDurableRepository(repository(true))).not.toThrow();
  });

  it('blocks a non-durable repository from being treated as production persistence', () => {
    expect(() => assertDurableRepository(repository(false))).toThrow('not durable');
  });
});
