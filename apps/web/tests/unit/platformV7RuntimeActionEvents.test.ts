import { describe, expect, it } from 'vitest';
import { buildPlatformV7RuntimeActionEvent } from '@/lib/platform-v7/runtime-action-events';

const at = '2026-04-28T12:00:00.000Z';

describe('platform-v7 runtime action events', () => {
  it('creates a pending bank review event without treating it as bank confirmation', () => {
    const result = buildPlatformV7RuntimeActionEvent({
      actionId: 'request_bank_reserve_review',
      actorRole: 'buyer',
      targetId: 'DL-2403-MONEY',
      reason: 'черновик сделки готов к проверке резерва',
      at,
    });

    expect(result.status).toBe('created');
    if (result.status !== 'created') throw new Error('Expected runtime event');

    expect(result).toEqual(expect.objectContaining({
      externalSystem: 'bank',
      externalConfirmationStatus: 'requested',
      resultingState: 'pending_bank_review',
      doesNotConfirmExternally: true,
    }));
    expect(result.logEntry).toEqual(expect.objectContaining({
      scope: 'bank',
      status: 'started',
      action: 'bank_reserve_review_requested',
      actor: 'buyer',
      objectId: 'DL-2403-MONEY',
    }));
    expect(result.logEntry.message).toContain('Ожидается подтверждение внешней системы: bank.');
    expect(result.logEntry.message).toContain('Не подтверждает резерв');
  });

  it('creates a pending FGIS event without treating it as FGIS confirmation', () => {
    const result = buildPlatformV7RuntimeActionEvent({
      actionId: 'request_fgis_check',
      actorRole: 'seller',
      targetId: 'PARTY-2403',
      at,
    });

    expect(result.status).toBe('created');
    if (result.status !== 'created') throw new Error('Expected runtime event');

    expect(result.externalSystem).toBe('fgis');
    expect(result.externalConfirmationStatus).toBe('requested');
    expect(result.logEntry.status).toBe('started');
    expect(result.logEntry.action).toBe('fgis_check_requested');
    expect(result.logEntry.message).toContain('Не подтверждает ФГИС');
    expect(result.logEntry.message).toContain('Ожидается подтверждение внешней системы: fgis.');
  });

  it('creates an internal document event as a success only because no external confirmation is required', () => {
    const result = buildPlatformV7RuntimeActionEvent({
      actionId: 'attach_internal_document',
      actorRole: 'operator',
      targetId: 'DOC-2403-1',
      at,
    });

    expect(result.status).toBe('created');
    if (result.status !== 'created') throw new Error('Expected runtime event');

    expect(result.externalSystem).toBe('none');
    expect(result.externalConfirmationStatus).toBe('not_required');
    expect(result.logEntry.status).toBe('success');
    expect(result.logEntry.action).toBe('internal_document_attached');
    expect(result.logEntry.message).toContain('Не является ЭДО, УКЭП или внешним подтверждением.');
  });

  it('blocks driver from bank and FGIS actions', () => {
    const bank = buildPlatformV7RuntimeActionEvent({
      actionId: 'request_bank_payment_basis_review',
      actorRole: 'driver',
      targetId: 'DL-2403-MONEY',
      at,
    });

    const fgis = buildPlatformV7RuntimeActionEvent({
      actionId: 'request_fgis_check',
      actorRole: 'driver',
      targetId: 'PARTY-2403',
      at,
    });

    expect(bank).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'У роли нет права выполнить это действие.',
    }));
    expect(fgis).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'У роли нет права выполнить это действие.',
    }));
  });

  it('keeps driver action limited to internal field evidence', () => {
    const result = buildPlatformV7RuntimeActionEvent({
      actionId: 'record_field_evidence',
      actorRole: 'driver',
      targetId: 'TRIP-2403-EVIDENCE-1',
      at,
    });

    expect(result.status).toBe('created');
    if (result.status !== 'created') throw new Error('Expected runtime event');

    expect(result.externalSystem).toBe('none');
    expect(result.externalConfirmationStatus).toBe('not_required');
    expect(result.logEntry.scope).toBe('logistics');
    expect(result.logEntry.status).toBe('success');
    expect(result.logEntry.message).toContain('Создаёт внутреннее доказательство.');
  });

  it('blocks empty target id before creating an audit event', () => {
    const result = buildPlatformV7RuntimeActionEvent({
      actionId: 'open_dispute_case',
      actorRole: 'operator',
      targetId: '   ',
      at,
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'Не выбран объект действия.',
    }));
  });

  it('does not use unsafe maturity or payment language in generated messages', () => {
    const events = [
      buildPlatformV7RuntimeActionEvent({ actionId: 'request_bank_reserve_review', actorRole: 'operator', targetId: 'MONEY-1', at }),
      buildPlatformV7RuntimeActionEvent({ actionId: 'request_bank_payment_basis_review', actorRole: 'operator', targetId: 'MONEY-2', at }),
      buildPlatformV7RuntimeActionEvent({ actionId: 'request_fgis_check', actorRole: 'operator', targetId: 'PARTY-1', at }),
      buildPlatformV7RuntimeActionEvent({ actionId: 'open_dispute_case', actorRole: 'operator', targetId: 'DISPUTE-1', at }),
    ];

    const messages = events
      .filter((event): event is Extract<typeof event, { status: 'created' }> => event.status === 'created')
      .map((event) => event.logEntry.message)
      .join('\n');

    expect(messages).not.toContain('production-ready');
    expect(messages).not.toContain('fully live');
    expect(messages).not.toContain('fully integrated');
    expect(messages).not.toContain('гарантирует оплату');
    expect(messages).not.toContain('К выпуску');
    expect(messages).not.toContain('Выпущено');
  });
});
