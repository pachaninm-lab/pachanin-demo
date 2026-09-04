import { EventEmitter } from 'node:events';
import { installLastResortHandlers, type ClosableApplication } from './last-resort-handlers';

/**
 * Последний рубеж процесса API (ASVS 5.0 V16.5.4).
 *
 * Замерено на Node 22, а не взято из документации: и uncaughtException, и
 * unhandledRejection завершают процесс немедленно с кодом 1 даже при живом
 * setInterval. Значит прежнее поведение — не «Node продолжает работать», а
 * жёсткая остановка в обход всех путей завершения.
 *
 * Поэтому набор проверяет ФОРМУ остановки, а не сам факт. И главное — обратную
 * сторону: обработчик, который залогировал и продолжил обслуживать трафик,
 * хуже падения, которое он заменил.
 */

function fixture(overrides: Partial<Parameters<typeof installLastResortHandlers>[0]> = {}) {
  const processRef = new EventEmitter() as EventEmitter & { exitCode?: number | string | null };
  const stderr: string[] = [];
  const exits: number[] = [];
  const app: ClosableApplication = { close: jest.fn().mockResolvedValue(undefined) };

  installLastResortHandlers({
    app,
    processRef,
    writeStderr: async (message: string) => { stderr.push(message); },
    forceExit: (code: number) => { exits.push(code); },
    closeTimeoutMs: 50,
    ...overrides,
  });

  return { processRef, stderr, exits, app };
}

/** Даёт обработчику доработать: он асинхронный, а emit() возвращается сразу. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

describe('installLastResortHandlers', () => {
  it.each(['uncaughtException', 'unhandledRejection'])(
    '%s: причина попадает в stderr со стеком',
    async (event) => {
      const { processRef, stderr } = fixture();
      const error = new Error('boom');

      processRef.emit(event, error);
      await settle();

      expect(stderr.join('')).toContain(event);
      expect(stderr.join('')).toContain('boom');
      // Стек, а не только сообщение: без него запись бесполезна для разбора.
      expect(stderr.join('')).toContain('last-resort-handlers.spec.ts');
    },
  );

  it.each(['uncaughtException', 'unhandledRejection'])(
    '%s: приложение закрывается, чтобы сработали shutdown hooks',
    async (event) => {
      const { processRef, app } = fixture();

      processRef.emit(event, new Error('boom'));
      await settle();

      expect(app.close).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['uncaughtException', 'unhandledRejection'])(
    '%s: процесс всё равно выходит ненулевым кодом',
    async (event) => {
      // Обратная сторона и главная. Обработчик, который проглотил фатальную
      // ошибку и оставил приложение обслуживать трафик, хуже падения: он
      // держит открытым приложение, чьи инварианты уже нарушены.
      const { processRef, exits } = fixture();

      processRef.emit(event, new Error('boom'));
      await settle();

      expect(exits).toContain(1);
      expect(processRef.exitCode).toBe(1);
    },
  );

  it('код выхода выставлен ДО close(), поэтому падение close() его не отменяет', async () => {
    const app: ClosableApplication = { close: jest.fn().mockRejectedValue(new Error('close failed')) };
    const { processRef, exits, stderr } = fixture({ app });

    processRef.emit('uncaughtException', new Error('boom'));
    await settle();

    expect(processRef.exitCode).toBe(1);
    expect(exits).toContain(1);
    expect(stderr.join('')).toContain('shutdown failed');
    expect(stderr.join('')).toContain('close failed');
  });

  it('зависший close() не удерживает процесс: выход форсируется по таймауту', async () => {
    const app: ClosableApplication = { close: jest.fn(() => new Promise<void>(() => undefined)) };
    const { processRef, exits, stderr } = fixture({ app });

    processRef.emit('uncaughtException', new Error('boom'));
    await settle();

    expect(stderr.join('')).toContain('timed out');
    expect(exits).toContain(1);
  });

  it('вторая фатальная ошибка во время завершения не запускает второе завершение', async () => {
    const { processRef, app } = fixture();

    processRef.emit('uncaughtException', new Error('first'));
    processRef.emit('unhandledRejection', new Error('second'));
    await settle();

    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it('обработчики одноразовые: повторное событие уходит поведению Node по умолчанию', () => {
    const { processRef } = fixture();

    expect(processRef.listenerCount('uncaughtException')).toBe(1);
    processRef.emit('uncaughtException', new Error('boom'));
    expect(processRef.listenerCount('uncaughtException')).toBe(0);
  });

  it('сигналы не перехватываются: SIGTERM и SIGINT остаются за Nest', () => {
    // Второй обработчик того же сигнала запустил бы два завершения сразу.
    const { processRef } = fixture();

    expect(processRef.listenerCount('SIGTERM')).toBe(0);
    expect(processRef.listenerCount('SIGINT')).toBe(0);
  });

  it('нефатальное значение тоже описывается, а не теряется', async () => {
    // reject(строкой) — не Error, и стека у него нет; запись обязана остаться.
    const { processRef, stderr } = fixture();

    processRef.emit('unhandledRejection', 'plain string reason');
    await settle();

    expect(stderr.join('')).toContain('plain string reason');
  });

  it('без фатального события ничего не происходит', () => {
    // Обратная сторона: установка обработчиков сама по себе не должна ни
    // закрывать приложение, ни писать в stderr.
    const { app, stderr, exits, processRef } = fixture();

    expect(app.close).not.toHaveBeenCalled();
    expect(stderr).toHaveLength(0);
    expect(exits).toHaveLength(0);
    expect(processRef.exitCode).toBeUndefined();
  });
});
