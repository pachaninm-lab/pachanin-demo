import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type SagaStepId =
  | 'publish_lot'
  | 'match_offer'
  | 'sign_contract'
  | 'reserve_payment'
  | 'assign_logistics'
  | 'start_shipment'
  | 'record_checkpoints'
  | 'deliver'
  | 'take_lab_sample'
  | 'lab_result'
  | 'sign_acceptance_act'
  | 'send_to_edo'
  | 'fgis_register'
  | 'release_payment'
  | 'charge_commission'
  | 'close';

export type SagaStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'PAUSED';

export interface SagaStep {
  stepId: SagaStepId;
  status: SagaStepStatus;
  attempt: number;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface DealSagaState {
  dealId: string;
  currentStep: SagaStepId | null;
  steps: SagaStep[];
  paused: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const STEP_ORDER: SagaStepId[] = [
  'publish_lot',
  'match_offer',
  'sign_contract',
  'reserve_payment',
  'assign_logistics',
  'start_shipment',
  'record_checkpoints',
  'deliver',
  'take_lab_sample',
  'lab_result',
  'sign_acceptance_act',
  'send_to_edo',
  'fgis_register',
  'release_payment',
  'charge_commission',
  'close',
];

const IDEMPOTENCY_KEY = (dealId: string, stepId: string, attempt: number) =>
  `saga:${dealId}:${stepId}:${attempt}`;

@Injectable()
export class DealSagaService {
  private readonly logger = new Logger(DealSagaService.name);
  private readonly sagas = new Map<string, DealSagaState>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  init(dealId: string): DealSagaState {
    if (this.sagas.has(dealId)) return this.sagas.get(dealId)!;

    const now = new Date().toISOString();
    const saga: DealSagaState = {
      dealId,
      currentStep: STEP_ORDER[0],
      steps: STEP_ORDER.map((stepId) => ({
        stepId,
        status: 'PENDING' as SagaStepStatus,
        attempt: 0,
      })),
      paused: false,
      createdAt: now,
      updatedAt: now,
    };
    this.sagas.set(dealId, saga);
    this.persistSaga(saga).catch(() => {});
    return saga;
  }

  getState(dealId: string): DealSagaState | null {
    return this.sagas.get(dealId) ?? null;
  }

  advance(dealId: string, stepId: SagaStepId, metadata?: Record<string, unknown>): SagaStep {
    const saga = this.getOrInit(dealId);
    const step = saga.steps.find((s) => s.stepId === stepId);
    if (!step) throw new Error(`Unknown saga step: ${stepId}`);

    step.attempt += 1;
    step.status = 'IN_PROGRESS';
    step.startedAt = new Date().toISOString();
    step.metadata = metadata;
    saga.currentStep = stepId;
    saga.updatedAt = new Date().toISOString();

    this.logger.log(`Saga advance: deal=${dealId} step=${stepId} attempt=${step.attempt}`);
    this.persistSaga(saga).catch(() => {});
    return step;
  }

  complete(dealId: string, stepId: SagaStepId, metadata?: Record<string, unknown>): SagaStep {
    const saga = this.getOrInit(dealId);
    const step = saga.steps.find((s) => s.stepId === stepId);
    if (!step) throw new Error(`Unknown saga step: ${stepId}`);

    step.status = 'COMPLETED';
    step.completedAt = new Date().toISOString();
    if (metadata) step.metadata = { ...step.metadata, ...metadata };
    saga.updatedAt = new Date().toISOString();

    const nextStepId = this.findNextPendingStep(saga);
    saga.currentStep = nextStepId;
    if (!nextStepId) {
      saga.completedAt = new Date().toISOString();
      this.logger.log(`Saga COMPLETED: deal=${dealId}`);
    }

    this.persistSaga(saga).catch(() => {});
    return step;
  }

  fail(dealId: string, stepId: SagaStepId, error: string): SagaStep {
    const saga = this.getOrInit(dealId);
    const step = saga.steps.find((s) => s.stepId === stepId);
    if (!step) throw new Error(`Unknown saga step: ${stepId}`);

    step.status = 'FAILED';
    step.failedAt = new Date().toISOString();
    step.error = error;
    saga.updatedAt = new Date().toISOString();
    this.logger.warn(`Saga FAILED: deal=${dealId} step=${stepId} error=${error}`);
    this.persistSaga(saga).catch(() => {});
    return step;
  }

  skip(dealId: string, stepId: SagaStepId, reason: string): SagaStep {
    const saga = this.getOrInit(dealId);
    const step = saga.steps.find((s) => s.stepId === stepId);
    if (!step) throw new Error(`Unknown saga step: ${stepId}`);

    step.status = 'SKIPPED';
    step.completedAt = new Date().toISOString();
    step.metadata = { skipReason: reason };
    const nextStepId = this.findNextPendingStep(saga);
    saga.currentStep = nextStepId;
    saga.updatedAt = new Date().toISOString();
    this.persistSaga(saga).catch(() => {});
    return step;
  }

  pause(dealId: string, reason: string): DealSagaState {
    const saga = this.getOrInit(dealId);
    saga.paused = true;
    saga.updatedAt = new Date().toISOString();
    this.logger.log(`Saga PAUSED: deal=${dealId} reason=${reason}`);
    this.persistSaga(saga).catch(() => {});
    return saga;
  }

  resume(dealId: string): DealSagaState {
    const saga = this.getOrInit(dealId);
    saga.paused = false;
    saga.updatedAt = new Date().toISOString();
    this.logger.log(`Saga RESUMED: deal=${dealId}`);
    this.persistSaga(saga).catch(() => {});
    return saga;
  }

  retry(dealId: string, stepId: SagaStepId): SagaStep {
    const saga = this.getOrInit(dealId);
    const step = saga.steps.find((s) => s.stepId === stepId);
    if (!step) throw new Error(`Unknown saga step: ${stepId}`);
    if (step.status !== 'FAILED') throw new Error(`Step ${stepId} is not in FAILED state`);

    step.status = 'PENDING';
    step.error = undefined;
    step.failedAt = undefined;
    saga.currentStep = stepId;
    saga.updatedAt = new Date().toISOString();
    return step;
  }

  idempotencyKey(dealId: string, stepId: SagaStepId, attempt?: number): string {
    const saga = this.sagas.get(dealId);
    const currentAttempt = saga?.steps.find((s) => s.stepId === stepId)?.attempt ?? 0;
    return IDEMPOTENCY_KEY(dealId, stepId, attempt ?? currentAttempt);
  }

  private getOrInit(dealId: string): DealSagaState {
    return this.sagas.get(dealId) ?? this.init(dealId);
  }

  private findNextPendingStep(saga: DealSagaState): SagaStepId | null {
    const pending = saga.steps.find((s) => s.status === 'PENDING');
    return pending?.stepId ?? null;
  }

  /**
   * Сохранение саги, которое на сегодня НЕ СОХРАНЯЕТ НИЧЕГО, — и до этой правки
   * об этом не сообщалось ни разу.
   *
   * Измерено на PostgreSQL 16 против настоящих функции и триггера из миграции
   * 20260712194000_deal_basis_immutability:
   *
   *   UPDATE sagaState + sagaStep  -> ERROR: confirmed deal commercial and
   *                                   saga basis is immutable
   *   UPDATE только sagaStep       -> UPDATE 1
   *   UPDATE только sagaState      -> тот же ERROR
   *
   * `sagaState` входит и в список колонок триггера, и в сравниваемый ROW,
   * поэтому любая его запись отбивается. `sagaStep` не входит НИ В ОДИН из
   * двух списков и изменяем сам по себе — но здесь он пишется тем же
   * оператором, а RAISE в BEFORE-триггере отменяет оператор целиком. Изменяемая
   * колонка теряется как побочная жертва неизменяемой.
   *
   * Принципал роли не играет: замер выполнен под rolsuper=true и всё равно
   * получил отказ. Триггеры, в отличие от RLS, связывают и суперпользователя.
   *
   * Следствие: единственное состояние саги — Map в памяти процесса, и весь
   * прогресс теряется при перезапуске.
   *
   * Здесь чинится ТОЛЬКО молчание. Что делать дальше — убрать писателя или
   * сузить неизменяемость, выведя `sagaState` из ROW, — это решение по модулю,
   * оно за владельцем и заведено в #4887. Ни один из вариантов тут не
   * выбирается: запись не переставляется и не разделяется на два оператора,
   * иначе я бы молча принял второй вариант.
   *
   * Логируется на warn, а не на error, и один раз за вызов: отказ ожидаемый и
   * постоянный, пока #4887 не решён, и поднимать его до error значило бы
   * заявить инцидент там, где известен открытый дефект.
   */
  private async persistSaga(saga: DealSagaState): Promise<void> {
    if (!this.prisma) return;
    try {
      await this.prisma.deal.update({
        where: { id: saga.dealId },
        data: {
          sagaState: JSON.stringify(saga.steps),
          sagaStep: saga.currentStep ?? undefined,
        },
      });
    } catch (error) {
      // Проглотить исключение по-прежнему обязательно: сохранение саги не
      // должно ронять шаг, который уже выполнен. Меняется ровно одно — теперь
      // об этом известно.
      this.logger.warn(
        `Saga persist failed: deal=${saga.dealId} step=${saga.currentStep ?? 'none'} `
        + `error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
