import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';

import {
  OFF_PLATFORM_INDICATORS,
  ReportOffPlatformSettlementDto,
} from '../../anti-fraud/dto/anti-fraud-api.dto';
import {
  BlockUserDto,
  EvaluatePolicyDto,
  RequeueOutboxEntryDto,
  UpdateUserOrgDto,
  UpdateUserRoleDto,
} from './admin-api.dto';

/**
 * V2.2.1 / V2.2.2 — живые административные поверхности.
 *
 * Шесть обработчиков объявляли тело инлайн-типом. Два из них ничего не делают:
 * legacy-admin-identity-boundary.ts подменяет AuthService.updateUserRole и
 * updateUserOrg функциями, которые бросают ServiceUnavailableException. Они
 * типизированы, но о закрытии бреши тут речи нет — это записано и в DTO.
 *
 * Четыре остальных живые, и одна из них молчала.
 */

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
const asBody = <T>(metatype: new () => T) => (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype } as never);

const role = asBody(UpdateUserRoleDto);
const org = asBody(UpdateUserOrgDto);
const requeue = asBody(RequeueOutboxEntryDto);
const block = asBody(BlockUserDto);
const policy = asBody(EvaluatePolicyDto);
const offPlatform = asBody(ReportOffPlatformSettlementDto);

/** Ровно тот switch, что в checkOffPlatformSettlement: без default. */
const scoreIndicator = (indicator: string) => {
  let score = 0;
  switch (indicator) {
    case 'external_payment_mentioned': score = 85; break;
    case 'deal_cancelled_after_delivery': score = 75; break;
    case 'reputation_drop_post_cancel': score = 40; break;
    case 'counterparty_comment_flag': score = 55; break;
  }
  return { score, flagged: score >= 50 };
};

describe('сообщение об обходе платформы — что происходило до правки', () => {
  it('опечатка в индикаторе тихо превращает донос в «ничего подозрительного»', () => {
    // Порог срабатывания — 50, а неизвестный индикатор оставляет score нулём,
    // поэтому persistFlag не вызывается и в аудит не попадает ничего.
    expect(scoreIndicator('external_payment_mentionned')).toEqual({ score: 0, flagged: false });
    expect(scoreIndicator('внеплатформенный_расчёт')).toEqual({ score: 0, flagged: false });
    expect(scoreIndicator('')).toEqual({ score: 0, flagged: false });
  });

  it('а известный индикатор помечает сделку', () => {
    expect(scoreIndicator('external_payment_mentioned')).toEqual({ score: 85, flagged: true });
  });

  it('теперь опечатка отвергается на двери', async () => {
    const base = { dealId: 'd', buyerOrgId: 'b', sellerOrgId: 's' };
    await expect(offPlatform({ ...base, indicator: 'external_payment_mentionned' })).rejects.toThrow();
    await expect(offPlatform({ ...base, indicator: '' })).rejects.toThrow();
    await expect(offPlatform({ ...base, indicator: 42 })).rejects.toThrow();
  });

  it.each(OFF_PLATFORM_INDICATORS)('%s по-прежнему принимается', async (indicator) => {
    await expect(offPlatform({ dealId: 'd', buyerOrgId: 'b', sellerOrgId: 's', indicator }))
      .resolves.toMatchObject({ indicator });
  });

  it('обязательные идентификаторы обязательны, evidence — нет', async () => {
    await expect(offPlatform({ buyerOrgId: 'b', sellerOrgId: 's', indicator: OFF_PLATFORM_INDICATORS[0] }))
      .rejects.toThrow();
    await expect(offPlatform({
      dealId: 'd', buyerOrgId: 'b', sellerOrgId: 's', indicator: OFF_PLATFORM_INDICATORS[0], evidence: 'скриншот',
    })).resolves.toMatchObject({ evidence: 'скриншот' });
  });

  it('evidence ограничен по длине: он попадает в reasons и оттуда в аудит', async () => {
    const base = { dealId: 'd', buyerOrgId: 'b', sellerOrgId: 's', indicator: OFF_PLATFORM_INDICATORS[3] };
    await expect(offPlatform({ ...base, evidence: 'x'.repeat(2001) })).rejects.toThrow();
    await expect(offPlatform({ ...base, evidence: 'x'.repeat(2000) })).resolves.toBeDefined();
  });
});

describe('движок политик — тело решало, из чего считается решение о доступе', () => {
  const base = { action: 'deal.read', user: { role: 'ADMIN' }, resource: { type: 'deal' } };

  it('subject и resource должны быть объектами, а не строкой, числом или массивом', async () => {
    for (const bad of ['ADMIN', 42, ['ADMIN'], null]) {
      await expect(policy({ ...base, user: bad })).rejects.toThrow();
      await expect(policy({ ...base, resource: bad })).rejects.toThrow();
    }
    await expect(policy(base)).resolves.toMatchObject({ action: 'deal.read' });
  });

  it('открытая форма внутри объекта сохраняется: PolicyInput открыт по замыслу', async () => {
    const result = await policy({
      ...base,
      user: { id: 'u', role: 'FARMER', organizationId: 'o', tenantId: 't', mfaVerified: true },
      resource: { type: 'deal', id: 'd', dealId: 'd', tenantId: 't' },
    });
    expect(result.user).toMatchObject({ role: 'FARMER', mfaVerified: true });
    expect(result.resource).toMatchObject({ type: 'deal', dealId: 'd' });
  });

  it('действие — строка ограниченной длины: имя правила, а не полезная нагрузка', async () => {
    await expect(policy({ ...base, action: 'x'.repeat(241) })).rejects.toThrow();
    await expect(policy({ ...base, action: 42 })).rejects.toThrow();
  });
});

describe('выгрузка из outbox и блокировка пользователя', () => {
  it('повторная отправка требует причину и ключ идемпотентности строками', async () => {
    await expect(requeue({ reason: 'дубликат', idempotencyKey: 'k-1' })).resolves.toMatchObject({ reason: 'дубликат' });
    await expect(requeue({ reason: 'дубликат' })).rejects.toThrow();
    await expect(requeue({ reason: 42, idempotencyKey: 'k-1' })).rejects.toThrow();
    await expect(requeue({ reason: 'x'.repeat(2001), idempotencyKey: 'k-1' })).rejects.toThrow();
  });

  // Обработчик отвечает разным текстом на true и false, а поле было голым
  // boolean — то есть в рантайме чем угодно.
  it('blocked — именно логическое значение, а не строка «false»', async () => {
    await expect(block({ blocked: 'false' })).rejects.toThrow();
    await expect(block({ blocked: 0 })).rejects.toThrow();
    await expect(block({ blocked: false })).resolves.toMatchObject({ blocked: false });
    await expect(block({ blocked: true })).resolves.toMatchObject({ blocked: true });
  });
});

describe('отключённые поверхности — типизированы, но брешь ими не закрыта', () => {
  it('роль проверяется по списку Role', async () => {
    await expect(role({ role: 'КОРОЛЬ' })).rejects.toThrow();
    await expect(role({ role: 'ADMIN' })).resolves.toMatchObject({ role: 'ADMIN' });
  });

  it('идентификатор организации — строка ограниченной длины', async () => {
    await expect(org({ orgId: 42 })).rejects.toThrow();
    await expect(org({ orgId: 'o-1' })).resolves.toMatchObject({ orgId: 'o-1' });
  });
});
