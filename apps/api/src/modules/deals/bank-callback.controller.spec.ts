import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

// Контроллер резолвит секрет в момент импорта модуля через requireSecret.
// Задаём env ДО require контроллера (не import, чтобы не сработал hoisting) —
// иначе взялся бы эфемерный per-process секрет, неизвестный тесту.
const SECRET = 'bank-webhook-test-secret-least-32-characters-long';
process.env.BANK_WEBHOOK_SECRET = SECRET;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BankCallbackController } = require('./bank-callback.controller') as typeof import('./bank-callback.controller');

describe('BankCallbackController', () => {
  let controller: InstanceType<typeof BankCallbackController>;
  let gateway: { executeBankCallback: jest.Mock };

  const sign = (tsSec: number, body: unknown) =>
    'sha256=' +
    crypto.createHmac('sha256', SECRET).update(`${tsSec}.${JSON.stringify(body)}`).digest('hex');

  const validBody = {
    dealId: 'deal-1',
    operation: 'RESERVE',
    status: 'SUCCESS',
    bankRef: 'RSHB-REF-0001',
    operationId: 'bank-reserve:deal-1',
    eventId: 'evt-0001',
  };

  beforeEach(() => {
    gateway = { executeBankCallback: jest.fn().mockResolvedValue({ ok: true, status: 'RESERVED' }) };
    controller = new BankCallbackController(gateway as any);
  });

  it('принимает валидно подписанный callback и делегирует в шлюз', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const res = await controller.bankCallback(validBody, sign(ts, validBody), String(ts), undefined, 'rshb-sandbox');

    expect(gateway.executeBankCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: 'deal-1',
        operation: 'RESERVE',
        status: 'SUCCESS',
        bankRef: 'RSHB-REF-0001',
        operationId: 'bank-reserve:deal-1',
        eventId: 'evt-0001',
        partnerId: 'rshb-sandbox',
      }),
    );
    expect(res).toMatchObject({ status: 'accepted', dealId: 'deal-1', operation: 'RESERVE' });
  });

  it('отклоняет неверную подпись (401) и не трогает шлюз', async () => {
    const ts = Math.floor(Date.now() / 1000);
    await expect(
      controller.bankCallback(validBody, 'sha256=' + '0'.repeat(64), String(ts), undefined, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(gateway.executeBankCallback).not.toHaveBeenCalled();
  });

  it('требует подпись', async () => {
    const ts = Math.floor(Date.now() / 1000);
    await expect(
      controller.bankCallback(validBody, undefined, String(ts), undefined, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('отклоняет устаревшую метку времени как replay', async () => {
    const stale = Math.floor(Date.now() / 1000) - 3600;
    await expect(
      controller.bankCallback(validBody, sign(stale, validBody), String(stale), undefined, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(gateway.executeBankCallback).not.toHaveBeenCalled();
  });

  it('требует метку времени для банка', async () => {
    await expect(
      controller.bankCallback(validBody, 'sha256=x', undefined, undefined, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('валидирует operation', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const bad = { ...validBody, operation: 'TRANSFER' };
    await expect(
      controller.bankCallback(bad, sign(ts, bad), String(ts), undefined, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('валидирует status', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const bad = { ...validBody, status: 'MAYBE' };
    await expect(
      controller.bankCallback(bad, sign(ts, bad), String(ts), undefined, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('требует dealId и bankRef', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const bad = { ...validBody, dealId: '' };
    await expect(
      controller.bankCallback(bad, sign(ts, bad), String(ts), undefined, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('идемпотентен по eventId: повтор не вызывает шлюз второй раз', async () => {
    const ts = Math.floor(Date.now() / 1000);
    await controller.bankCallback(validBody, sign(ts, validBody), String(ts), undefined, 'rshb-sandbox');
    const second = await controller.bankCallback(validBody, sign(ts, validBody), String(ts), undefined, 'rshb-sandbox');
    expect(gateway.executeBankCallback).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ status: 'already_processed', eventId: 'evt-0001' });
  });

  it('проводит FAILED-статус в шлюз (запись отказа банка)', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const failed = { ...validBody, status: 'FAILED', errorMessage: 'Недостаточно средств', eventId: 'evt-fail' };
    await controller.bankCallback(failed, sign(ts, failed), String(ts), undefined, undefined);
    expect(gateway.executeBankCallback).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorMessage: 'Недостаточно средств' }),
    );
  });
});
