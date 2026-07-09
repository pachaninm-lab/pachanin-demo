import { describe, expect, it } from 'vitest';
import type { DomainDeal } from '@/lib/domain/types';
import { platformV7ActionTargetById } from '@/lib/platform-v7/action-targets';
import {
  buildP7DealWorkspaceRuntimeActionRequest,
  p7DealWorkspaceRuntimeActionIsWritable,
  p7DealWorkspaceRuntimeActionRequiresServerAction,
} from '@/lib/platform-v7/deal-workspace-runtime-actions';
import { validatePlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';

const deal: Pick<DomainDeal, 'id' | 'seller' | 'buyer' | 'reservedAmount' | 'holdAmount' | 'releaseAmount' | 'blockers'> = {
  id: 'DL-9106',
  seller: { name: 'КФХ Сокол', inn: '6801000000' },
  buyer: { name: 'Мелькомбинат', inn: '7701000000' },
  reservedAmount: 9_650_000,
  holdAmount: 0,
  releaseAmount: 9_650_000,
  blockers: [],
};

const actor = { actorId: 'operator-1', actorRole: 'operator', organizationId: 'platform-ops' };
const nowIso = '2026-07-09T15:30:00.000Z';

function target(id: string) {
  const found = platformV7ActionTargetById(id);
  if (!found) throw new Error(`Missing target ${id}`);
  return found;
}

describe('VP-3 deal workspace runtime actions', () => {
  it('maps request bank basis button to money server action DTO', () => {
    const request = buildP7DealWorkspaceRuntimeActionRequest({ deal, target: target('deal-request-release'), actor, nowIso });

    expect(request.status).toBe('ready');
    if (request.status !== 'ready') return;
    expect(request.channel).toBe('money');
    expect(request.action).toBe('request_bank_basis');
    expect(request.dto.amount).toBe(9_650_000);
    expect(request.dto.currency).toBe('RUB');
    expect(validatePlatformV7IdempotencyKey(request.dto.idempotency.idempotencyKey).ok).toBe(true);
    expect(request.safePath).toContain('executeP7RuntimeMoneyAction');
    expect(p7DealWorkspaceRuntimeActionIsWritable(request)).toBe(true);
    expect(p7DealWorkspaceRuntimeActionRequiresServerAction(request)).toBe(true);
  });

  it('blocks bank basis request when deal has hold or blockers', () => {
    const request = buildP7DealWorkspaceRuntimeActionRequest({
      deal: { ...deal, holdAmount: 100_000 },
      target: target('deal-request-release'),
      actor,
      nowIso,
    });

    expect(request.status).toBe('blocked');
    expect(request.channel).toBe('money');
    if (request.status === 'blocked') expect(request.reason).toContain('Active hold');
  });

  it('maps send basis to bank through bankBasisWorkflow without claiming direct money movement', () => {
    const request = buildP7DealWorkspaceRuntimeActionRequest({
      deal,
      target: target('deal-release-funds'),
      actor,
      nowIso,
      basisDocumentIds: ['doc-contract', 'doc-acceptance'],
    });

    expect(request.status).toBe('ready');
    if (request.status !== 'ready') return;
    expect(request.channel).toBe('bankBasisWorkflow');
    expect(request.action).toBe('send_basis_to_bank');
    expect(request.dto.basisDocumentIds).toEqual(['doc-contract', 'doc-acceptance']);
    expect(request.safePath).toContain('does not release money directly');
  });

  it('maps document and dispute actions to their runtime service channels', () => {
    const docs = buildP7DealWorkspaceRuntimeActionRequest({ deal, target: target('deal-complete-docs'), actor, nowIso });
    const dispute = buildP7DealWorkspaceRuntimeActionRequest({ deal, target: target('deal-open-dispute'), actor, nowIso });

    expect(docs.status).toBe('ready');
    if (docs.status === 'ready') {
      expect(docs.channel).toBe('document');
      expect(docs.action).toBe('confirm_document');
      expect(docs.dto.documentStatus).toBe('confirmed');
    }

    expect(dispute.status).toBe('ready');
    if (dispute.status === 'ready') {
      expect(dispute.channel).toBe('disputeSettlement');
      expect(dispute.action).toBe('open_dispute');
    }
  });
});
