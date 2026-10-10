import { Logger } from '@nestjs/common';
import { DealSagaService } from './deal-saga.service';

/**
 * persistSaga не сохраняет ничего — и до правки об этом не сообщалось.
 *
 * Измерено на PostgreSQL 16 против настоящих функции и триггера из миграции
 * 20260712194000_deal_basis_immutability:
 *
 *   UPDATE sagaState + sagaStep -> ERROR (confirmed deal ... basis is immutable)
 *   UPDATE только sagaStep      -> UPDATE 1
 *   UPDATE только sagaState     -> тот же ERROR
 *
 * `sagaState` входит и в список колонок триггера, и в сравниваемый ROW.
 * `sagaStep` не входит ни в один и изменяем сам по себе, но пишется тем же
 * оператором, а RAISE в BEFORE-триггере отменяет оператор целиком. Замер
 * выполнялся под rolsuper=true и всё равно получил отказ: триггеры, в отличие
 * от RLS, связывают и суперпользователя.
 *
 * Здесь проверяется ровно то, что чинилось, — молчание. Что делать с самой
 * записью, решает владелец в #4887, и этот набор ни один из вариантов не
 * закрепляет: он не утверждает, что запись обязана падать, только что её
 * падение обязано быть слышно и не обязано ронять шаг.
 */
describe('DealSagaService — отказ сохранения саги слышен', () => {
  const REJECTION = new Error('confirmed deal commercial and saga basis is immutable');

  function serviceWithFailingPersist() {
    const update = jest.fn().mockRejectedValue(REJECTION);
    const prisma = { deal: { update } };
    return { service: new DealSagaService(prisma as never), update };
  }

  it('сообщает об отказе, а не глотает его', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, update } = serviceWithFailingPersist();

    service.init('deal-1');
    // persistSaga вызывается без await, поэтому даём микрозадачам отработать.
    await Promise.resolve();
    await Promise.resolve();

    expect(update).toHaveBeenCalled();
    const reported = warn.mock.calls.map((args) => String(args[0]));
    expect(reported.some((line) => line.includes('Saga persist failed'))).toBe(true);
    expect(reported.some((line) => line.includes('deal-1'))).toBe(true);
    // Причина отказа должна попасть в запись, иначе сообщение не отличает
    // неизменяемость от, скажем, недоступной базы.
    expect(reported.some((line) => line.includes('immutable'))).toBe(true);

    warn.mockRestore();
  });

  it('шаг саги всё равно выполняется: отказ сохранения не ронять', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service } = serviceWithFailingPersist();

    // Ни один из вызовов не должен бросить, хотя запись отказывает на каждом.
    expect(() => service.init('deal-2')).not.toThrow();
    const step = service.advance('deal-2', service.getState('deal-2')!.currentStep!);
    expect(step.status).toBe('IN_PROGRESS');
    await Promise.resolve();
    await Promise.resolve();

    // И состояние в памяти продвинулось, несмотря на отказ записи.
    expect(service.getState('deal-2')?.currentStep).toBe(step.stepId);

    warn.mockRestore();
  });

  it('успешная запись ничего не докладывает', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const prisma = { deal: { update: jest.fn().mockResolvedValue({}) } };
    const service = new DealSagaService(prisma as never);

    service.init('deal-3');
    await Promise.resolve();
    await Promise.resolve();

    const reported = warn.mock.calls.map((args) => String(args[0]));
    expect(reported.some((line) => line.includes('Saga persist failed'))).toBe(false);

    warn.mockRestore();
  });

  it('без prisma запись не пытается выполниться и не жалуется', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new DealSagaService();

    expect(() => service.init('deal-4')).not.toThrow();
    await Promise.resolve();

    const reported = warn.mock.calls.map((args) => String(args[0]));
    expect(reported.some((line) => line.includes('Saga persist failed'))).toBe(false);

    warn.mockRestore();
  });
});
