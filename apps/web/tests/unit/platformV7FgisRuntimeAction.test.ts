import { describe, expect, it } from 'vitest';
import { buildPlatformV7FgisCheckRuntimeAction } from '@/lib/platform-v7/fgis-runtime-action';

const now = '2026-04-28T12:00:00.000Z';

function unsafeCopyGuard(text: string) {
  expect(text).not.toMatch(/production-ready/i);
  expect(text).not.toMatch(/fully live/i);
  expect(text).not.toMatch(/fully integrated/i);
  expect(text).not.toMatch(/ФГИС подтверждён/i);
  expect(text).not.toMatch(/партия подтверждена/i);
  expect(text).not.toMatch(/СДИЗ подтверждён/i);
  expect(text).not.toMatch(/остаток подтверждён/i);
}

describe('platform-v7 fgis runtime action helper', () => {
  it('creates FGIS check request as pending external confirmation', () => {
    const result = buildPlatformV7FgisCheckRuntimeAction({
      actorRole: 'seller',
      partyId: 'FGIS-PARTY-2403',
      reason: 'Партия должна пройти сверку перед допуском к сделке',
      at: now,
    });

    expect(result.status).toBe('created');
    expect(result.partyId).toBe('FGIS-PARTY-2403');
    expect(result.uiStatusLabel).toBe('запрос сверки ФГИС создан');
    expect(result.uiSafetyNote).toContain('ждёт внешнее событие ФГИС');
    expect(result.uiSafetyNote).toContain('не считает партию, остаток или СДИЗ подтверждёнными');

    expect(result.event.status).toBe('created');
    if (result.event.status !== 'created') throw new Error('Expected created event');

    expect(result.event).toEqual(expect.objectContaining({
      actionId: 'request_fgis_check',
      externalSystem: 'fgis',
      externalConfirmationStatus: 'requested',
      resultingState: 'pending_external_confirmation',
      doesNotConfirmExternally: true,
    }));
    expect(result.event.logEntry).toEqual(expect.objectContaining({
      scope: 'lot',
      status: 'started',
      action: 'fgis_check_requested',
      actor: 'seller',
      objectId: 'FGIS-PARTY-2403',
      at: now,
    }));
    expect(result.event.logEntry.message).toContain('Не подтверждает ФГИС, партию, остаток или СДИЗ без внешнего события.');
    expect(result.event.logEntry.message).toContain('Ожидается подтверждение внешней системы: fgis.');
    unsafeCopyGuard(result.event.logEntry.message + result.uiSafetyNote);
  });

  it('blocks roles that cannot request FGIS check', () => {
    const result = buildPlatformV7FgisCheckRuntimeAction({
      actorRole: 'driver',
      partyId: 'FGIS-PARTY-2403',
      at: now,
    });

    expect(result.status).toBe('blocked');
    expect(result.uiStatusLabel).toBe('сверка ФГИС не создана');
    expect(result.uiSafetyNote).toBe('У роли нет права выполнить это действие.');
    expect(result.event.status).toBe('blocked');
  });

  it('blocks empty party id before creating an audit event', () => {
    const result = buildPlatformV7FgisCheckRuntimeAction({
      actorRole: 'operator',
      partyId: '   ',
      at: now,
    });

    expect(result.status).toBe('blocked');
    expect(result.partyId).toBe('');
    expect(result.uiSafetyNote).toBe('Не выбран объект действия.');
    expect(result.event.status).toBe('blocked');
  });
});
