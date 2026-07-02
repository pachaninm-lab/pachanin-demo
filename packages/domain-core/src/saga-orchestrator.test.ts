import { describe, it, expect, vi } from 'vitest';
import { SagaOrchestrator, DEAL_SAGA_STEPS, type DealSagaContext } from './saga-orchestrator';

describe('SagaOrchestrator', () => {
  const makeCtx = (): DealSagaContext => ({
    dealId: 'd1',
    buyerId: 'b1',
    sellerId: 's1',
    amount: 100_000,
    currencyCode: 'RUB',
  });

  it('executes all steps in order', async () => {
    const order: string[] = [];
    const steps = DEAL_SAGA_STEPS.map((name) => ({
      name,
      execute: async (ctx: DealSagaContext) => { order.push(name); return ctx; },
    }));
    const saga = new SagaOrchestrator<DealSagaContext>(steps);
    const result = await saga.execute(makeCtx());
    expect(result.success).toBe(true);
    expect(order).toEqual([...DEAL_SAGA_STEPS]);
    expect(result.steps.every((s) => s.status === 'DONE')).toBe(true);
  });

  it('retries on transient failure then succeeds', async () => {
    let calls = 0;
    const steps = [
      {
        name: 'reserve_payment',
        maxRetries: 3,
        execute: async (ctx: DealSagaContext) => {
          calls++;
          if (calls < 3) throw new Error('network timeout');
          return { ...ctx, paymentReservationId: 'r1' };
        },
      },
    ];
    const saga = new SagaOrchestrator<DealSagaContext>(steps);
    const result = await saga.execute(makeCtx());
    expect(result.success).toBe(true);
    expect(calls).toBe(3);
  });

  it('sends to DLQ on exhausted retries', async () => {
    const steps = [
      {
        name: 'reserve_payment',
        maxRetries: 2,
        execute: async (_ctx: DealSagaContext): Promise<DealSagaContext> => {
          throw new Error('bank unavailable');
        },
      },
    ];
    const saga = new SagaOrchestrator<DealSagaContext>(steps);
    const result = await saga.execute(makeCtx());
    expect(result.success).toBe(false);
    expect(result.dlq).toBeDefined();
    expect(result.dlq!.length).toBeGreaterThan(0);
    expect(result.dlq![0].step).toBe('reserve_payment');
  });

  it('runs compensations in reverse on failure', async () => {
    const compensated: string[] = [];
    const steps = [
      {
        name: 'validate_parties',
        execute: async (ctx: DealSagaContext) => ctx,
        compensate: async (ctx: DealSagaContext) => { compensated.push('validate_parties'); return ctx; },
      },
      {
        name: 'reserve_payment',
        execute: async (ctx: DealSagaContext) => ctx,
        compensate: async (ctx: DealSagaContext) => { compensated.push('reserve_payment'); return ctx; },
      },
      {
        name: 'generate_contract',
        maxRetries: 1,
        execute: async (_ctx: DealSagaContext): Promise<DealSagaContext> => { throw new Error('generation failed'); },
      },
    ];
    const saga = new SagaOrchestrator<DealSagaContext>(steps);
    const result = await saga.execute(makeCtx());
    expect(result.success).toBe(false);
    expect(compensated).toEqual(['reserve_payment', 'validate_parties']);
  });

  it('DEAL_SAGA_STEPS contains all 11 canonical steps', () => {
    expect(DEAL_SAGA_STEPS.length).toBe(11);
    expect(DEAL_SAGA_STEPS[0]).toBe('validate_parties');
    expect(DEAL_SAGA_STEPS[10]).toBe('close_deal');
  });
});
