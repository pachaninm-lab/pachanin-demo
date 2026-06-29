export type SagaStepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'COMPENSATING' | 'COMPENSATED' | 'AWAITING_HUMAN';

export interface SagaStep<C = unknown> {
  name: string;
  execute: (ctx: C) => Promise<C>;
  compensate?: (ctx: C) => Promise<C>;
  maxRetries?: number;
  requiresHumanApproval?: boolean;
}

export interface SagaStepRecord {
  name: string;
  status: SagaStepStatus;
  attempts: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SagaResult<C = unknown> {
  success: boolean;
  context: C;
  steps: SagaStepRecord[];
  dlq?: Array<{ step: string; error: string; context: unknown }>;
}

export class SagaOrchestrator<C = unknown> {
  private dlq: Array<{ step: string; error: string; context: unknown }> = [];

  constructor(private readonly steps: SagaStep<C>[]) {}

  async execute(initialContext: C): Promise<SagaResult<C>> {
    let ctx = initialContext;
    const records: SagaStepRecord[] = this.steps.map((s) => ({ name: s.name, status: 'PENDING', attempts: 0 }));
    const completed: Array<{ step: SagaStep<C>; ctx: C }> = [];

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const rec = records[i];
      rec.status = 'RUNNING';
      rec.startedAt = new Date().toISOString();
      const maxRetries = step.maxRetries ?? 3;

      let success = false;
      let lastError = '';

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        rec.attempts = attempt;
        try {
          ctx = await step.execute(ctx);
          success = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt < maxRetries) {
            await sleep(Math.pow(2, attempt - 1) * 100);
          }
        }
      }

      if (!success) {
        rec.status = 'FAILED';
        rec.error = lastError;
        rec.completedAt = new Date().toISOString();

        this.dlq.push({ step: step.name, error: lastError, context: ctx });

        // Run compensations in reverse
        for (let j = completed.length - 1; j >= 0; j--) {
          const prev = completed[j];
          const prevRec = records[this.steps.indexOf(prev.step)];
          if (prev.step.compensate) {
            prevRec.status = 'COMPENSATING';
            try {
              ctx = await prev.step.compensate(prev.ctx);
              prevRec.status = 'COMPENSATED';
            } catch {
              prevRec.status = 'FAILED';
            }
          }
        }

        return { success: false, context: ctx, steps: records, dlq: this.dlq };
      }

      rec.status = 'DONE';
      rec.completedAt = new Date().toISOString();
      completed.push({ step, ctx });
    }

    return { success: true, context: ctx, steps: records, dlq: this.dlq };
  }

  getDlq() {
    return this.dlq;
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Deal saga step names (canonical) ─────────────────────────────────────────
export const DEAL_SAGA_STEPS = [
  'validate_parties',
  'reserve_payment',
  'generate_contract',
  'sign_contract',
  'assign_logistics',
  'track_delivery',
  'accept_quality',
  'sign_acceptance_act',
  'release_payment',
  'send_to_edo',
  'close_deal',
] as const;

export type DealSagaStep = (typeof DEAL_SAGA_STEPS)[number];

export interface DealSagaContext {
  dealId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  currencyCode: 'RUB';
  contractId?: string;
  shipmentId?: string;
  acceptanceActId?: string;
  edoDocumentId?: string;
  paymentReservationId?: string;
  status?: string;
}
